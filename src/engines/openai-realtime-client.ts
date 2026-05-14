/**
 * OpenAI Realtime Translation client (direct WebSocket from device).
 *
 * Endpoint: wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate
 *
 * Auth: requires `Authorization: Bearer <key>` and `OpenAI-Beta: realtime=v1`
 * headers on the WS handshake. React Native's WebSocket supports a 3rd-arg
 * `{ headers }` option on iOS + Android, but this is the single biggest
 * unknown for this engine — if Apple's NSURLSession ever strips the header,
 * we'll need to swap to a manual handshake via `react-native-tcp-socket`.
 * **Verify on a physical iOS device before shipping** (Phase 3 step 0).
 *
 * Event mapping mirrors the desktop Rust backend (see
 * src-tauri/src/commands/openai_realtime.rs in the desktop repo):
 *   session.input_transcript.delta/.done    → onSourceProvisional / onSegment(src)
 *   session.output_transcript.delta/.done   → onProvisional       / onSegment(tgt)
 *   session.output_audio.delta              → outputQueue.push(b64)
 *   error / session.closed                  → onError / onClosed
 *
 * Audio: input is pcm16 @ 24kHz mono (AudioCapture(24000) handles this), wire
 * encoded as { type: "session.input_audio_buffer.append", audio: <base64> }.
 */

import type { OpenAiAudioOutputQueue } from "@/src/lib/openai-audio-output-queue";

const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate";

export type OpenAiStatus = "connecting" | "ready" | "closed" | "error";

export interface OpenAiRealtimeConfig {
  apiKey: string;
  sourceLanguage?: string;
  targetLanguage: string;
  audioOutput?: boolean;
}

export interface OpenAiRealtimeCallbacks {
  onStatusChange?: (status: OpenAiStatus, message?: string) => void;
  onSegment?: (sourceText: string, translatedText: string) => void;
  onProvisional?: (text: string) => void;
  onSourceProvisional?: (text: string) => void;
  onError?: (code: string, message: string) => void;
  onClosed?: (reason: string) => void;
}

interface WSWithHeaders {
  new (url: string, protocols?: string | string[] | null, options?: { headers?: Record<string, string> }): WebSocket;
}

export class OpenAiRealtimeClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private muted = false;
  private outputQueue: OpenAiAudioOutputQueue | null = null;

  private provisionalBuffer = "";
  private sourceBuffer = "";
  // Source-language finals from whisper, waiting to be paired with the next
  // translated target final. Whisper + translation finalize independently.
  private pendingSourceFinals: string[] = [];

  constructor(public callbacks: OpenAiRealtimeCallbacks = {}) {}

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.outputQueue?.flush();
  }

  connect(cfg: OpenAiRealtimeConfig, outputQueue: OpenAiAudioOutputQueue): void {
    this.outputQueue = outputQueue;
    this.muted = cfg.audioOutput === false;
    this.provisionalBuffer = "";
    this.sourceBuffer = "";
    this.pendingSourceFinals = [];

    this.callbacks.onStatusChange?.("connecting");

    let ws: WebSocket;
    try {
      const WSCtor = WebSocket as unknown as WSWithHeaders;
      ws = new WSCtor(OPENAI_REALTIME_URL, null, {
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
        },
      });
    } catch (err) {
      this.callbacks.onError?.("connect_failed", (err as Error).message);
      this.callbacks.onStatusChange?.("error", (err as Error).message);
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      const sessionUpdate = {
        type: "session.update",
        session: {
          audio: {
            input: {
              transcription: { model: "gpt-realtime-whisper" },
              noise_reduction: { type: "near_field" },
            },
            output: { language: cfg.targetLanguage },
          },
        },
      };
      try {
        ws.send(JSON.stringify(sessionUpdate));
      } catch (err) {
        this.callbacks.onError?.("session_update_failed", (err as Error).message);
        return;
      }
      this.callbacks.onStatusChange?.("ready");
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        this.handleServerEvent(data);
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      this.callbacks.onError?.("ws_error", "WebSocket error");
      this.callbacks.onStatusChange?.("error", "WebSocket error");
    };

    ws.onclose = (event) => {
      this.connected = false;
      this.ws = null;
      const reason = `${event.code}: ${event.reason || "closed"}`;
      this.callbacks.onClosed?.(reason);
      this.callbacks.onStatusChange?.("closed", reason);
    };
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (pcm.byteLength === 0) return;
    const b64 = arrayBufferToBase64(pcm);
    try {
      this.ws.send(
        JSON.stringify({ type: "session.input_audio_buffer.append", audio: b64 }),
      );
    } catch {
      /* ignore — onclose / onerror will surface real failure */
    }
  }

  /**
   * Emit any in-flight buffers as a final segment so stop-mid-sentence text
   * isn't silently dropped. Safe to call multiple times.
   */
  flushPending(): void {
    try {
      while (this.pendingSourceFinals.length > 1) {
        this.callbacks.onSegment?.(this.pendingSourceFinals.shift()!, "");
      }
      const tgt = this.provisionalBuffer;
      const src = this.pendingSourceFinals.shift() ?? this.sourceBuffer;
      this.provisionalBuffer = "";
      this.sourceBuffer = "";
      if (tgt || src) this.callbacks.onSegment?.(src, tgt);
    } catch {
      /* ignore */
    }
  }

  disconnect(): void {
    if (!this.ws) {
      this.connected = false;
      return;
    }
    this.connected = false;
    this.flushPending();
    try {
      this.ws.close(1000, "User disconnected");
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.outputQueue?.flush();
  }

  private handleServerEvent(data: Record<string, unknown>): void {
    const rawType = data.type as string | undefined;
    if (!rawType) return;
    if (__DEV__) console.log("[openai-realtime] evt:", rawType);
    // Server emits some events with `session.` prefix and others without —
    // normalize so we match either form.
    const type = rawType.startsWith("session.") ? rawType.slice(8) : rawType;

    switch (type) {
      case "created":
      case "updated":
        break;

      case "input_transcript.delta":
      case "conversation.item.input_audio_transcription.delta": {
        const delta = (data.delta as string) ?? "";
        if (delta) {
          this.sourceBuffer += delta;
          this.callbacks.onSourceProvisional?.(this.sourceBuffer);
        }
        break;
      }

      case "input_transcript.done":
      case "input_audio_transcription.completed":
      case "conversation.item.input_audio_transcription.completed": {
        const text = (data.transcript as string) ?? (data.text as string) ?? "";
        if (text) {
          this.pendingSourceFinals.push(text);
          this.sourceBuffer = "";
          this.callbacks.onSourceProvisional?.(text);
        }
        break;
      }

      case "output_transcript.delta":
      case "response.output_text.delta":
      case "response.text.delta": {
        const delta = (data.delta as string) ?? "";
        if (delta) {
          this.provisionalBuffer += delta;
          this.callbacks.onProvisional?.(this.provisionalBuffer);
        }
        break;
      }

      case "output_transcript.done":
      case "response.output_text.done":
      case "response.text.done": {
        const text =
          (data.transcript as string) ?? (data.text as string) ?? this.provisionalBuffer;
        const sourceText = this.pendingSourceFinals.shift() ?? this.sourceBuffer;
        this.provisionalBuffer = "";
        this.sourceBuffer = "";
        this.callbacks.onSegment?.(sourceText, text);
        break;
      }

      case "output_audio.delta":
      case "response.output_audio.delta":
      case "response.audio.delta": {
        const b64 = data.delta as string | undefined;
        if (b64 && !this.muted) this.outputQueue?.push(b64);
        break;
      }

      case "closed":
        this.callbacks.onClosed?.("session.closed");
        break;

      case "error": {
        const err = (data.error ?? {}) as { code?: string; message?: string };
        this.callbacks.onError?.(err.code ?? "unknown", err.message ?? "");
        break;
      }

      default:
        // Unknown event type — ignore but keep parsing.
        break;
    }
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // Hermes provides global.btoa. RN doesn't always, so build from bytes.
  const bytes = new Uint8Array(buf);
  let bin = "";
  // chunk to avoid String.fromCharCode arg-count limits on large buffers
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  if (typeof btoa === "function") return btoa(bin);
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(bin, "binary").toString("base64");
  }
  // Fallback should never run on RN, but keep types happy.
  return "";
}
