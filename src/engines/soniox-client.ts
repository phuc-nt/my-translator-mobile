/**
 * Soniox WebSocket client — TS port of desktop src/js/soniox.js.
 * Mobile MVP scope: one-way translation only (no two-way, no custom context).
 *
 * Auth: API key sent in first JSON config message (no headers). Works on RN WS.
 */

const SONIOX_ENDPOINT = "wss://stt-rt.soniox.com/transcribe-websocket";
const MAX_RECONNECT = 3;
const RECONNECT_DELAY_MS = 2000;
const SESSION_DURATION_MS = 3 * 60 * 1000;
const CONTEXT_HISTORY_CHARS = 500;
const KEEPALIVE_INTERVAL_MS = 15000;

export type SonioxStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface SonioxConfig {
  apiKey: string;
  sourceLanguage?: string;
  targetLanguage: string;
  endpointDelayMs?: number;
}

export interface SonioxCallbacks {
  onOriginal?: (text: string, speaker: string | null, language: string | null) => void;
  onTranslation?: (text: string) => void;
  onProvisional?: (text: string, speaker?: string | null, language?: string | null) => void;
  onStatusChange?: (status: SonioxStatus) => void;
  onError?: (error: string) => void;
}

interface TaggedWebSocket extends WebSocket {
  _isOld?: boolean;
}

export class SonioxClient {
  private ws: TaggedWebSocket | null = null;
  private config: SonioxConfig | null = null;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private recentTranslations: string[] = [];

  constructor(public callbacks: SonioxCallbacks = {}) {}

  connect(config: SonioxConfig): void {
    if (!config.apiKey) {
      this.setStatus("error");
      this.callbacks.onError?.("Soniox API key required");
      return;
    }
    this.config = config;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.recentTranslations = [];
    this.doConnect(config, null);
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm);
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.stopSessionTimer();
    this.stopKeepalive();
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(new ArrayBuffer(0));
        }
        this.ws.close(1000, "User disconnected");
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  private doConnect(config: SonioxConfig, carryover: string | null): void {
    this.setStatus("connecting");
    let newWs: TaggedWebSocket;
    try {
      newWs = new WebSocket(SONIOX_ENDPOINT) as TaggedWebSocket;
    } catch (err) {
      this.setStatus("error");
      this.callbacks.onError?.(`Failed to create WebSocket: ${(err as Error).message}`);
      return;
    }

    newWs.onopen = () => {
      const cfg: Record<string, unknown> = {
        api_key: config.apiKey,
        model: "stt-rt-v5",
        audio_format: "pcm_s16le",
        sample_rate: 16000,
        num_channels: 1,
        enable_endpoint_detection: true,
        max_endpoint_delay_ms: config.endpointDelayMs ?? 3000,
        enable_speaker_diarization: true,
        enable_language_identification: true,
        translation: { type: "one_way", target_language: config.targetLanguage },
      };
      if (config.sourceLanguage && config.sourceLanguage !== "auto") {
        cfg.language_hints = [config.sourceLanguage];
      }
      if (carryover) {
        cfg.context = { text: `Recent conversation: ${carryover}` };
      }
      newWs.send(JSON.stringify(cfg));

      // make-before-break: close old WS after new one is ready
      const oldWs = this.ws;
      if (oldWs && oldWs !== newWs) {
        try {
          if (oldWs.readyState === WebSocket.OPEN) {
            oldWs.send(new ArrayBuffer(0));
          }
          oldWs._isOld = true;
          oldWs.close(1000, "Session reset");
        } catch {
          /* ignore */
        }
      }

      this.ws = newWs;
      this.reconnectAttempts = 0;
      this.setStatus("connected");
      this.startSessionTimer();
      this.startKeepalive();
    };

    newWs.onmessage = (event) => {
      if (newWs._isOld) return;
      try {
        const data = JSON.parse(event.data as string);
        if (data.error_code) {
          this.handleApiError(data);
          return;
        }
        this.handleResponse(data);
      } catch (err) {
        // ignore parse errors
      }
    };

    newWs.onerror = () => {
      if (newWs._isOld) return;
      this.callbacks.onError?.("WebSocket error");
    };

    newWs.onclose = (event) => {
      if (newWs._isOld) return;
      if (this.ws === newWs) this.ws = null;

      if (this.intentionalDisconnect) {
        this.setStatus("disconnected");
        return;
      }
      const code = event.code;
      if (code === 1000) {
        this.setStatus("disconnected");
      } else if (code === 4001 || code === 4003) {
        this.setStatus("error");
        this.callbacks.onError?.("Invalid Soniox API key");
      } else if (code === 4029) {
        this.setStatus("error");
        this.callbacks.onError?.("Rate limit exceeded");
      } else if (code === 4002) {
        this.setStatus("error");
        this.callbacks.onError?.("Subscription issue — check Soniox account");
      } else {
        this.tryReconnect(`Closed (code ${code})`);
      }
    };
  }

  private handleResponse(data: { tokens?: SonioxToken[] }): void {
    if (!data.tokens || data.tokens.length === 0) return;
    let originalText = "";
    let translationText = "";
    let provisionalText = "";
    let hasEnd = false;
    let speaker: string | null = null;
    let language: string | null = null;

    for (const token of data.tokens) {
      if (token.text === "<end>") {
        hasEnd = true;
        continue;
      }
      if (token.speaker && token.translation_status === "original") {
        speaker = token.speaker;
      }
      if (token.language && token.translation_status !== "translation") {
        language = token.language;
      }
      if (token.translation_status === "original" || token.translation_status === "none") {
        if (token.is_final) originalText += token.text;
        else provisionalText += token.text;
      } else if (token.translation_status === "translation") {
        if (token.is_final) translationText += token.text;
      }
    }

    if (originalText.trim()) {
      this.callbacks.onOriginal?.(originalText, speaker, language);
    }
    if (translationText.trim()) {
      this.callbacks.onTranslation?.(translationText);
      this.addToHistory(translationText);
    }
    if (provisionalText.trim()) {
      this.callbacks.onProvisional?.(provisionalText, speaker, language);
    } else if (originalText.trim() || translationText.trim() || hasEnd) {
      this.callbacks.onProvisional?.("");
    }
  }

  private startSessionTimer(): void {
    this.stopSessionTimer();
    this.sessionTimer = setTimeout(() => this.seamlessReset(), SESSION_DURATION_MS);
  }

  private stopSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private seamlessReset(): void {
    if (!this.config || this.intentionalDisconnect) return;
    this.doConnect(this.config, this.getCarryover());
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "keepalive" }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private addToHistory(text: string): void {
    this.recentTranslations.push(text);
    let total = this.recentTranslations.reduce((s, t) => s + t.length, 0);
    while (total > CONTEXT_HISTORY_CHARS && this.recentTranslations.length > 1) {
      total -= this.recentTranslations.shift()!.length;
    }
  }

  private getCarryover(): string | null {
    if (this.recentTranslations.length === 0) return null;
    return this.recentTranslations.join(" ").trim();
  }

  private handleApiError(data: { error_code?: number; error_message?: string }): void {
    const code = data.error_code ?? 0;
    const message = data.error_message ?? "Unknown API error";
    let userMessage = message;
    if (code === 401) userMessage = "Invalid Soniox API key";
    else if (code === 429) userMessage = "Rate limit exceeded";
    else if (code === 402) userMessage = "Insufficient Soniox credits";
    else if (code === 408) {
      this.tryReconnect("Request timeout");
      return;
    } else if (code === 400) userMessage = `Config error: ${message}`;

    this.setStatus("error");
    this.callbacks.onError?.(userMessage);
  }

  private tryReconnect(reason: string): void {
    if (this.reconnectAttempts >= MAX_RECONNECT) {
      this.setStatus("error");
      this.callbacks.onError?.(`${reason}. Reconnect failed after ${MAX_RECONNECT} attempts.`);
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    this.setStatus("connecting");
    this.callbacks.onError?.(`${reason}. Reconnecting (${this.reconnectAttempts}/${MAX_RECONNECT})...`);
    setTimeout(() => {
      if (!this.intentionalDisconnect && this.config) {
        this.doConnect(this.config, this.getCarryover());
      }
    }, delay);
  }

  private setStatus(status: SonioxStatus): void {
    this.callbacks.onStatusChange?.(status);
  }
}

interface SonioxToken {
  text: string;
  is_final?: boolean;
  speaker?: string;
  language?: string;
  confidence?: number;
  translation_status?: "original" | "translation" | "none";
}
