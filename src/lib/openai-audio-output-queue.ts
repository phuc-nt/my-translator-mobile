import {
  AudioContext,
  type AudioBufferQueueSourceNode,
  type GainNode,
} from "react-native-audio-api";

/**
 * Plays a continuous stream of 24kHz s16le mono PCM chunks via react-native-audio-api.
 * Mirrors desktop src/js/openai-audio-output-queue.js — same drop-when-too-far-ahead
 * policy but uses AudioBufferQueueSourceNode.enqueueBuffer() which handles tight
 * scheduling internally (no manual nextStartTime tracking needed).
 */

const SAMPLE_RATE = 24000;
const MAX_BUFFER_AHEAD_SEC = 2.0;
// Each enqueued buffer is ~tail of pending audio. We track total enqueued
// duration vs context time to honor MAX_BUFFER_AHEAD_SEC.
export class OpenAiAudioOutputQueue {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private source: AudioBufferQueueSourceNode | null = null;
  private nextStartTime = 0;
  private muted = false;

  private ensureContext(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.source = this.ctx.createBufferQueueSource();
    this.source.connect(this.gainNode);
    this.source.start();
    this.nextStartTime = this.ctx.currentTime;
  }

  push(base64Pcm: string): void {
    if (this.muted || !base64Pcm) return;
    this.ensureContext();
    const ctx = this.ctx!;
    const source = this.source!;

    const int16 = int16FromBase64(base64Pcm);
    if (int16.length === 0) return;

    const now = ctx.currentTime;
    const aheadSec = this.nextStartTime - now;
    if (aheadSec > MAX_BUFFER_AHEAD_SEC) {
      // Backend is sending faster than playback can drain — drop this chunk.
      return;
    }

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);
    source.enqueueBuffer(buffer);

    const startAt = Math.max(now, this.nextStartTime);
    this.nextStartTime = startAt + float32.length / SAMPLE_RATE;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.gainNode) this.gainNode.gain.value = m ? 0 : 1;
  }

  flush(): void {
    if (this.source) {
      try {
        this.source.clearBuffers();
      } catch {
        /* ignore */
      }
    }
    if (this.ctx) this.nextStartTime = this.ctx.currentTime;
  }

  async close(): Promise<void> {
    try {
      this.source?.stop();
    } catch {
      /* ignore */
    }
    this.source = null;
    this.gainNode = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
    }
    this.nextStartTime = 0;
  }
}

function int16FromBase64(b64: string): Int16Array {
  // RN polyfills `atob` via Hermes; fall back manually if missing.
  const bin =
    typeof atob === "function" ? atob(b64) : globalThis.Buffer
      ? globalThis.Buffer.from(b64, "base64").toString("binary")
      : "";
  if (!bin) return new Int16Array(0);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // Slice copy so the underlying ArrayBuffer is aligned for Int16Array.
  const copy = bytes.slice().buffer;
  return new Int16Array(copy, 0, Math.floor(copy.byteLength / 2));
}
