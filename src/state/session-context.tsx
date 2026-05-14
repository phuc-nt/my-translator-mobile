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
import { SonioxClient, type SonioxStatus } from "@/src/engines/soniox-client";
import { AudioCapture } from "@/src/lib/audio-capture";
import { OpenAiAudioOutputQueue } from "@/src/lib/openai-audio-output-queue";
import type { SessionStatus, TranscriptRow } from "@/src/types";
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
  const { engine, sonioxKey, openaiKey, sourceLang, targetLang } = useSettings();

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

  const cleanup = async () => {
    // Silence late callbacks BEFORE disconnect so events that arrive between
    // ws.close() and the OS actually tearing the socket down don't push
    // ghost provisional rows after the user already hit Stop.
    if (sonioxRef.current) sonioxRef.current.callbacks = {};
    if (openaiRef.current) openaiRef.current.callbacks = {};

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

  const start = async () => {
    if (status === "streaming" || status === "connecting") return;
    setErrorMessage(null);
    if (engine === "soniox") await startSoniox();
    else await startOpenAi();
  };

  const stop = async () => {
    setStatus("stopping");
    await cleanup();
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
