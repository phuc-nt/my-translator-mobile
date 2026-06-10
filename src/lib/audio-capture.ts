import { AudioManager, AudioRecorder } from "react-native-audio-api";

/**
 * Mic capture wrapper around react-native-audio-api's AudioRecorder.
 * Delivers raw PCM s16le ArrayBuffer chunks at the requested sample rate
 * (16k for Soniox, 24k for OpenAI Realtime).
 *
 * The recorder callback ships Float32 samples in [-1, 1]; we convert to
 * Int16 little-endian inline so engines can ws.send(arrayBuffer) directly.
 */
export class AudioCapture {
  private recorder: AudioRecorder | null = null;
  private running = false;

  constructor(
    private readonly sampleRate: number,
    private readonly bufferLength: number = Math.round(sampleRate / 10), // ~100ms
  ) {}

  async requestPermission(): Promise<boolean> {
    const result = await AudioManager.requestRecordingPermissions();
    return result === "Granted";
  }

  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    if (this.running) return;

    // Configure iOS audio session for recording before creating recorder.
    AudioManager.setAudioSessionOptions({
      iosCategory: "playAndRecord",
      iosMode: "spokenAudio",
      // SDK 56 renamed "allowBluetooth" → "allowBluetoothHFP" (Hands-Free
      // Profile — the BT mode that enables mic input, needed for playAndRecord).
      iosOptions: ["allowBluetoothHFP", "defaultToSpeaker"],
    });
    await AudioManager.setAudioSessionActivity(true);

    this.recorder = new AudioRecorder();

    const result = this.recorder.onAudioReady(
      {
        sampleRate: this.sampleRate,
        bufferLength: this.bufferLength,
        channelCount: 1,
      },
      ({ buffer }) => {
        const float = buffer.getChannelData(0);
        const pcm = floatToInt16Le(float);
        onChunk(pcm);
      },
    );
    if (result.status === "error") {
      throw new Error(`onAudioReady failed: ${result.message}`);
    }

    const startResult = this.recorder.start();
    if (startResult.status === "error") {
      throw new Error(`recorder.start failed: ${startResult.message}`);
    }
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    try {
      this.recorder?.clearOnAudioReady();
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.recorder = null;
    try {
      await AudioManager.setAudioSessionActivity(false);
    } catch {
      /* ignore */
    }
  }
}

function floatToInt16Le(float: Float32Array): ArrayBuffer {
  const out = new ArrayBuffer(float.length * 2);
  const view = new DataView(out);
  for (let i = 0; i < float.length; i++) {
    let s = Math.max(-1, Math.min(1, float[i]));
    // Match WebAudio convention: positive samples scale to 0x7FFF, negative to 0x8000.
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, s | 0, true);
  }
  return out;
}
