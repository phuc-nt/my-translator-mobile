import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  OpenAiRealtimeClient,
  type OpenAiStatus,
} from "@/src/engines/openai-realtime-client";
import {
  QwenRealtimeClient,
  type QwenStatus,
} from "@/src/engines/qwen-realtime-client";
import { SonioxClient, type SonioxStatus } from "@/src/engines/soniox-client";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";

import { AudioCapture } from "@/src/lib/audio-capture";
import { hapticError, hapticStart, hapticStop } from "@/src/lib/haptics";
import { OpenAiAudioOutputQueue } from "@/src/lib/openai-audio-output-queue";
import { autoNameSession, saveSession } from "@/src/lib/history-store";
import { pickKeyForModel } from "@/src/lib/openai-chat";
import type { SessionMeta, SessionStatus, TranscriptRow } from "@/src/types";
import { useSettings } from "@/src/state/settings-context";

interface SessionState {
  status: SessionStatus;
  rows: TranscriptRow[];
  errorMessage: string | null;
}

interface SessionActions {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  setMuted: (m: boolean) => void;
}

interface SessionExtras {
  muted: boolean;
}

const SessionContext = createContext<
  (SessionState & SessionActions & SessionExtras) | null
>(null);

const MAX_ROWS = 200;

export function SessionProvider({ children }: { children: ReactNode }) {
  const {
    engine,
    sonioxKey,
    openaiKey,
    qwenKey,
    sourceLang,
    targetLang,
    chatModel,
    ttsProvider,
    ttsRate,
    ttsVoice,
    ttsMuted,
  } = useSettings();

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Default muted: most usage is reading-only at events, and TTS audio costs
  // extra. User can unmute via the header speaker icon when needed.
  const [muted, setMutedState] = useState(true);

  const rowsRef = useRef<TranscriptRow[]>([]);
  const captureRef = useRef<AudioCapture | null>(null);
  const sonioxRef = useRef<SonioxClient | null>(null);
  const openaiRef = useRef<OpenAiRealtimeClient | null>(null);
  const qwenRef = useRef<QwenRealtimeClient | null>(null);
  const outputQueueRef = useRef<OpenAiAudioOutputQueue | null>(null);

  // The id of the in-progress provisional row, if any (cleared on final).
  const provisionalIdRef = useRef<string | null>(null);

  const replaceRows = (next: TranscriptRow[]) => {
    if (next.length > MAX_ROWS) next.splice(0, next.length - MAX_ROWS);
    rowsRef.current = next;
    setRows(next);
  };

  const pushRow = (row: TranscriptRow) => {
    replaceRows([...rowsRef.current, row]);
  };

  const upsertProvisional = (text: string) => {
    const id = provisionalIdRef.current;
    if (!text) {
      if (!id) return;
      const next = rowsRef.current.filter((r) => r.id !== id);
      provisionalIdRef.current = null;
      replaceRows(next);
      return;
    }
    if (id) {
      const next = rowsRef.current.map((r) =>
        r.id === id ? { ...r, translation: text } : r,
      );
      replaceRows(next);
    } else {
      const newId = `prov-${Date.now()}`;
      provisionalIdRef.current = newId;
      pushRow({
        id: newId,
        translation: text,
        isProvisional: true,
        timestamp: Date.now(),
      });
    }
  };

  // Remove the in-flight provisional row (if any) so the final segment that
  // follows doesn't visually duplicate it. Without this, Stop showed the same
  // text twice — once gray (provisional, still in list) and once white (final).
  const finalizeProvisional = () => {
    const id = provisionalIdRef.current;
    provisionalIdRef.current = null;
    if (!id) return;
    const next = rowsRef.current.filter((r) => r.id !== id);
    if (next.length !== rowsRef.current.length) replaceRows(next);
  };

  const mapSonioxStatus = (s: SonioxStatus): SessionStatus => {
    if (s === "connecting") return "connecting";
    if (s === "connected") return "streaming";
    if (s === "error") return "error";
    return "idle";
  };

  const mapOpenAiStatus = (s: OpenAiStatus): SessionStatus => {
    if (s === "connecting") return "connecting";
    if (s === "ready") return "streaming";
    if (s === "error") return "error";
    return "idle";
  };

  const mapQwenStatus = (s: QwenStatus): SessionStatus => {
    if (s === "connecting") return "connecting";
    if (s === "ready") return "streaming";
    if (s === "error") return "error";
    return "idle";
  };

  const cleanup = async () => {
    // Silence late callbacks BEFORE disconnect so events that arrive between
    // ws.close() and the OS actually tearing the socket down don't push
    // ghost provisional rows after the user already hit Stop.
    if (sonioxRef.current) sonioxRef.current.callbacks = {};
    if (openaiRef.current) openaiRef.current.callbacks = {};
    if (qwenRef.current) qwenRef.current.callbacks = {};

    try {
      sonioxRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sonioxRef.current = null;

    try {
      openaiRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    openaiRef.current = null;

    try {
      qwenRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    qwenRef.current = null;

    try {
      await outputQueueRef.current?.close();
    } catch {
      /* ignore */
    }
    outputQueueRef.current = null;

    try {
      await captureRef.current?.stop();
    } catch {
      /* ignore */
    }
    captureRef.current = null;

    provisionalIdRef.current = null;

    // Promote any leftover provisional rows to final (keep the text, drop the
    // gray opacity). The engine's flushPending may already have emitted a
    // matching final segment — dedupe by text to avoid showing the same line
    // twice once in white once in gray.
    const current = rowsRef.current;
    const finalsSet = new Set(
      current
        .filter((r) => !r.isProvisional && r.translation)
        .map((r) => r.translation),
    );
    const next = current
      .filter(
        (r) => !r.isProvisional || (r.translation && !finalsSet.has(r.translation)),
      )
      .map((r) => (r.isProvisional ? { ...r, isProvisional: false } : r));
    if (
      next.length !== current.length ||
      next.some((r, i) => r !== current[i])
    ) {
      replaceRows(next);
    }
  };

  const speakTTS = async (text: string) => {
    console.log("[TTS] speakTTS", { ttsProvider, ttsMuted, text: text.slice(0, 30) });
    if (ttsProvider === "none" || ttsMuted || !text.trim()) return;

    if (ttsProvider === "device") {
      try {
        console.log("[TTS] Using device voice");
        const Speech = await import("expo-speech");
        Speech.speak(text, {
          language: targetLang,
          rate: 1 + ttsRate / 100,
        });
      } catch (err) {
        console.warn("[TTS] Device error:", (err as Error).message);
      }
    } else if (ttsProvider === "edge") {
      try {
        console.log("[TTS] Using Edge TTS");
        const { edgeTTS } = await import("@/src/engines/edge-tts-client");
        const { edgeTTSPlayer } = await import(
          "@/src/lib/edge-tts-audio-player"
        );
        const { getDefaultVoice } = await import("@/src/lib/edge-tts-voices");
        const voice = ttsVoice || getDefaultVoice(targetLang);
        edgeTTS.configure({ voice, rate: ttsRate });
        const audio = await edgeTTS.speak(text);
        console.log("[TTS] Edge audio received", audio.length);
        await edgeTTSPlayer.enqueue(audio);
      } catch (err) {
        console.warn("[TTS] Edge error:", (err as Error).message);
      }
    }
  };

  const startSoniox = async (): Promise<void> => {
    if (!sonioxKey) {
      setStatus("error");
      setErrorMessage("Soniox API key missing — open Settings");
      return;
    }
    setStatus("connecting");

    const capture = new AudioCapture(16000);
    const granted = await capture.requestPermission();
    if (!granted) {
      setStatus("error");
      setErrorMessage("Microphone permission denied");
      return;
    }

    const client = new SonioxClient({
      onStatusChange: (s) => setStatus(mapSonioxStatus(s)),
      onError: (msg) => setErrorMessage(msg),
      onOriginal: (text) => {
        const last = rowsRef.current[rowsRef.current.length - 1];
        if (last && !last.isProvisional && !last.source) {
          const next = [...rowsRef.current];
          next[next.length - 1] = { ...last, source: text };
          replaceRows(next);
        } else {
          pushRow({
            id: `src-${Date.now()}`,
            source: text,
            translation: "",
            timestamp: Date.now(),
          });
        }
      },
      onTranslation: (text) => {
        finalizeProvisional();
        pushRow({
          id: `t-${Date.now()}`,
          translation: text,
          timestamp: Date.now(),
        });
        speakTTS(text);
      },
      onProvisional: (text) => upsertProvisional(text),
    });

    sonioxRef.current = client;
    captureRef.current = capture;

    try {
      await capture.start((pcm) => client.sendAudio(pcm));
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
      await cleanup();
      return;
    }

    client.connect({
      apiKey: sonioxKey,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
  };

  const startOpenAi = async (): Promise<void> => {
    if (!openaiKey) {
      setStatus("error");
      setErrorMessage("OpenAI API key missing — open Settings");
      return;
    }
    setStatus("connecting");

    const capture = new AudioCapture(24000);
    const granted = await capture.requestPermission();
    if (!granted) {
      setStatus("error");
      setErrorMessage("Microphone permission denied");
      return;
    }

    const queue = new OpenAiAudioOutputQueue();
    const client = new OpenAiRealtimeClient({
      onStatusChange: (s, msg) => {
        setStatus(mapOpenAiStatus(s));
        if (msg && s === "error") setErrorMessage(msg);
      },
      onError: (_code, message) => {
        if (message) setErrorMessage(message);
      },
      onClosed: () => {
        // onclose runs after disconnect() too — only surface unintended closes.
      },
      onSourceProvisional: (text) => {
        // For OpenAI: source provisional shows under translation; we mirror
        // Soniox's "source on most recent row" pattern by stashing source on
        // the active provisional row, or buffering until segment fires.
        const id = provisionalIdRef.current;
        if (!id) return;
        const next = rowsRef.current.map((r) =>
          r.id === id ? { ...r, source: text } : r,
        );
        replaceRows(next);
      },
      onProvisional: (text) => upsertProvisional(text),
      onSegment: (src, tgt) => {
        finalizeProvisional();
        if (!src && !tgt) return;
        pushRow({
          id: `seg-${Date.now()}`,
          source: src || undefined,
          translation: tgt,
          timestamp: Date.now(),
        });
        if (tgt) speakTTS(tgt);
      },
    });

    openaiRef.current = client;
    outputQueueRef.current = queue;
    captureRef.current = capture;

    try {
      await capture.start((pcm) => client.sendAudio(pcm));
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
      await cleanup();
      return;
    }

    queue.setMuted(muted);
    client.setMuted(muted);
    client.connect(
      {
        apiKey: openaiKey,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        audioOutput: !muted,
      },
      queue,
    );
  };

  const startQwen = async (): Promise<void> => {
    if (!qwenKey) {
      setStatus("error");
      setErrorMessage("Qwen API key missing — open Settings");
      return;
    }
    setStatus("connecting");

    // Qwen LiveTranslate input is pcm16 @ 16kHz. Text-only — no output queue.
    const capture = new AudioCapture(16000);
    const granted = await capture.requestPermission();
    if (!granted) {
      setStatus("error");
      setErrorMessage("Microphone permission denied");
      return;
    }

    const client = new QwenRealtimeClient({
      onStatusChange: (s, msg) => {
        setStatus(mapQwenStatus(s));
        if (msg && s === "error") setErrorMessage(msg);
      },
      onError: (_code, message) => {
        if (message) setErrorMessage(message);
      },
      onClosed: () => {
        // onclose runs after disconnect() too — only surface unintended closes.
      },
      onProvisional: (text) => upsertProvisional(text),
      onSegment: (src, tgt) => {
        finalizeProvisional();
        if (!src && !tgt) return;
        pushRow({
          id: `seg-${Date.now()}`,
          source: src || undefined,
          translation: tgt,
          timestamp: Date.now(),
        });
        if (tgt) speakTTS(tgt);
      },
    });

    qwenRef.current = client;
    captureRef.current = capture;

    try {
      await capture.start((pcm) => client.sendAudio(pcm));
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
      await cleanup();
      return;
    }

    client.connect({
      apiKey: qwenKey,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
  };

  const start = async () => {
    if (status === "streaming" || status === "connecting") return;
    setErrorMessage(null);
    hapticStart();
    if (engine === "soniox") await startSoniox();
    else if (engine === "openai") await startOpenAi();
    else await startQwen();
  };

  const stop = async () => {
    hapticStop();
    setStatus("stopping");
    await cleanup();

    // Persist the just-finished session. cleanup() has promoted provisional
    // rows to final, so rowsRef.current is the correct snapshot. Fire-and-
    // forget so the UI returns to idle without waiting on storage.
    const finals = rowsRef.current.filter(
      (r) => !r.isProvisional && r.translation,
    );
    if (finals.length > 0) {
      const meta: SessionMeta = {
        id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        engine,
        targetLang,
        rowCount: finals.length,
        preview: "",
      };
      // Persist, then best-effort LLM auto-name. Both off the UI path: stop()
      // returns to idle immediately regardless of storage/network outcome.
      const autoNameKey = pickKeyForModel(chatModel, openaiKey, qwenKey);
      saveSession(meta, finals)
        .then((ok) => {
          if (ok && autoNameKey) {
            autoNameSession(meta.id, autoNameKey, chatModel, targetLang).catch(
              () => {},
            );
          }
        })
        .catch(() => {});
    }

    setStatus("idle");
  };

  const clear = () => {
    rowsRef.current = [];
    provisionalIdRef.current = null;
    setRows([]);
    setErrorMessage(null);
  };

  const setMuted = (m: boolean) => {
    setMutedState(m);
    openaiRef.current?.setMuted(m);
    outputQueueRef.current?.setMuted(m);
  };

  // Keep the screen on for the whole live session (long meetings would
  // otherwise auto-lock mid-translation). Released the moment we leave an
  // active state, and on unmount.
  useEffect(() => {
    const active =
      status === "connecting" ||
      status === "streaming" ||
      status === "stopping";
    if (active) {
      activateKeepAwakeAsync("translate-session").catch(() => {});
    } else {
      deactivateKeepAwake("translate-session").catch(() => {});
    }
    if (status === "error") hapticError();
    return () => {
      deactivateKeepAwake("translate-session").catch(() => {});
    };
  }, [status]);

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider
      value={{ status, rows, errorMessage, muted, start, stop, clear, setMuted }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
