/**
 * Edge TTS client for React Native.
 * Connects to Microsoft Edge TTS via WebSocket with DRM token generation.
 * Returns base64 MP3 audio for playback.
 */

import { sha256 } from "js-sha256";

const BASE_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const WIN_EPOCH = 11644473600;
const WS_TIMEOUT_MS = 10000;

export type EdgeTTSError = "TIMEOUT" | "CONNECTION_FAILED" | "NO_AUDIO";

export interface EdgeTTSConfig {
  voice: string;
  rate: number;
}

function generateSecMsGec(): string {
  const now = Math.floor(Date.now() / 1000);
  let ticks = now + WIN_EPOCH;
  ticks -= ticks % 300;
  const ticksNs = ticks * 1e7;
  const strToHash = `${ticksNs.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return sha256(strToHash).toUpperCase();
}

function generateRequestId(): string {
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function getTimestamp(): string {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")} GMT+0000 (Coordinated Universal Time)`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class EdgeTTSClient {
  private voice = "vi-VN-NamMinhNeural";
  private rate = 20;
  private ws: WebSocket | null = null;

  configure(cfg: Partial<EdgeTTSConfig>): void {
    if (cfg.voice) this.voice = cfg.voice;
    if (cfg.rate !== undefined) this.rate = cfg.rate;
  }

  async speak(text: string): Promise<string> {
    return Promise.race([
      this._doSpeak(text),
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error("TIMEOUT" as EdgeTTSError)),
          WS_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  stop(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private async _doSpeak(text: string): Promise<string> {
    if (!text.trim()) {
      throw new Error("Empty text");
    }

    const requestId = generateRequestId();
    const secMsGec = generateSecMsGec();
    const secMsGecVersion = `1-${CHROMIUM_FULL_VERSION}`;

    const url =
      `${BASE_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
      `&ConnectionId=${requestId}&Sec-MS-GEC=${secMsGec}` +
      `&Sec-MS-GEC-Version=${secMsGecVersion}`;

    return new Promise((resolve, reject) => {
      // React Native WebSocket doesn't support custom headers.
      // Edge TTS works without them - the token in URL is sufficient.
      const ws = new WebSocket(url);
      this.ws = ws;

      const audioChunks: Uint8Array[] = [];
      let gotTurnEnd = false;

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const timestamp = getTimestamp();

        const configMsg =
          `X-Timestamp:${timestamp}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":` +
          `{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
          `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;

        ws.send(configMsg);

        const escapedText = escapeXml(text);
        const rateStr = this.rate >= 0 ? `+${this.rate}%` : `${this.rate}%`;

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${this.voice}'>` +
          `<prosody pitch='+0Hz' rate='${rateStr}' volume='+0%'>${escapedText}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg =
          `X-RequestId:${generateRequestId()}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${getTimestamp()}Z\r\n` +
          `Path:ssml\r\n\r\n${ssml}`;

        ws.send(ssmlMsg);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          if (event.data.includes("Path:turn.end")) {
            gotTurnEnd = true;
            ws.close();
          }
        } else if (event.data instanceof ArrayBuffer) {
          const data = new Uint8Array(event.data);
          if (data.length > 2) {
            const headerLen = (data[0] << 8) | data[1];
            if (data.length > 2 + headerLen) {
              const audioData = data.slice(2 + headerLen);
              audioChunks.push(audioData);
            }
          }
        }
      };

      ws.onerror = () => {
        this.ws = null;
        reject(new Error("CONNECTION_FAILED" as EdgeTTSError));
      };

      ws.onclose = () => {
        this.ws = null;

        if (!gotTurnEnd && audioChunks.length === 0) {
          reject(new Error("NO_AUDIO" as EdgeTTSError));
          return;
        }

        const totalLen = audioChunks.reduce((sum, c) => sum + c.length, 0);
        const combined = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of audioChunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const base64 = uint8ToBase64(combined);
        resolve(base64);
      };
    });
  }
}

export const edgeTTS = new EdgeTTSClient();
