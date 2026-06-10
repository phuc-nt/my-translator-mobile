/**
 * Audio player for Edge TTS MP3 output using expo-audio.
 * Queue-based playback for sequential TTS segments.
 */

import type { AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";

export class EdgeTTSAudioPlayer {
  private queue: string[] = [];
  private isPlaying = false;
  private currentPlayer: AudioPlayer | null = null;
  private enabled = true;

  async enqueue(base64Mp3: string): Promise<void> {
    if (!this.enabled || !base64Mp3) return;
    this.queue.push(base64Mp3);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const b64 = this.queue.shift()!;

    try {
      let uri: string;
      const file = new File(Paths.cache, `tts-${Date.now()}.mp3`);
      if (file.exists) file.delete();
      file.create();
      file.write(b64, { encoding: "base64" });
      uri = file.uri;

      const { createAudioPlayer } = await import("expo-audio");
      const player = createAudioPlayer({ uri });
      this.currentPlayer = player;

      player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          player.release();
          try {
            if (file.exists) file.delete();
          } catch (_) {
            /* ignore cleanup errors */
          }
          this.currentPlayer = null;
          this.playNext();
        }
      });

      player.play();
    } catch (err) {
      console.error("[EdgeTTSAudioPlayer] Play error:", err);
      this.currentPlayer = null;
      this.playNext();
    }
  }

  async stop(): Promise<void> {
    this.queue = [];
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
        this.currentPlayer.release();
      } catch (_) {
        /* ignore */
      }
      this.currentPlayer = null;
    }
    this.isPlaying = false;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  get active(): boolean {
    return this.isPlaying || this.queue.length > 0;
  }
}

export const edgeTTSPlayer = new EdgeTTSAudioPlayer();
