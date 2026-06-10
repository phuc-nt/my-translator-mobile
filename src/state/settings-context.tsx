import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_CHAT_MODEL } from "@/src/lib/openai-chat";
import {
  getPref,
  getSecureKey,
  setPref,
  setSecureKey,
} from "@/src/lib/secure-keys";
import type { Engine, LangCode, PanelMode } from "@/src/types";

export type TTSProvider = "none" | "device" | "edge";

interface SettingsState {
  sonioxKey: string;
  openaiKey: string;
  qwenKey: string;
  engine: Engine;
  sourceLang: LangCode;
  targetLang: LangCode;
  panelMode: PanelMode;
  fontSize: number;
  chatModel: string;
  ttsProvider: TTSProvider;
  ttsRate: number;
  ttsVoice: string;
  ttsMuted: boolean;
  loaded: boolean;
}

interface SettingsActions {
  setSonioxKey: (v: string) => Promise<void>;
  setOpenaiKey: (v: string) => Promise<void>;
  setQwenKey: (v: string) => Promise<void>;
  setEngine: (v: Engine) => void;
  setSourceLang: (v: LangCode) => void;
  setTargetLang: (v: LangCode) => void;
  setPanelMode: (v: PanelMode) => void;
  setFontSize: (v: number) => void;
  setChatModel: (v: string) => void;
  setTTSProvider: (v: TTSProvider) => void;
  setTTSRate: (v: number) => void;
  setTTSVoice: (v: string) => void;
  setTTSMuted: (v: boolean) => void;
}

const DEFAULT_STATE: SettingsState = {
  sonioxKey: "",
  openaiKey: "",
  qwenKey: "",
  engine: "soniox",
  // Default "auto" — Soniox/OpenAI auto-detect natively. Qwen LiveTranslate
  // does NOT auto-detect reliably (tested 2026-05-25 on real device: stops
  // after one segment), so for Qwen the UI defaults to a sensible value
  // ("en") and source picker is required.
  sourceLang: "auto",
  targetLang: "vi",
  panelMode: "single",
  fontSize: 18,
  chatModel: DEFAULT_CHAT_MODEL,
  ttsProvider: "none",
  ttsRate: 20,
  ttsVoice: "",
  ttsMuted: false,
  loaded: false,
};

const SettingsContext = createContext<(SettingsState & SettingsActions) | null>(
  null,
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(DEFAULT_STATE);

  useEffect(() => {
    (async () => {
      const [
        sonioxKey,
        openaiKey,
        qwenKey,
        engine,
        sourceLang,
        targetLang,
        panelMode,
        fontSize,
        chatModel,
        ttsProvider,
        ttsRate,
        ttsVoice,
        ttsMuted,
      ] = await Promise.all([
        getSecureKey("soniox"),
        getSecureKey("openai"),
        getSecureKey("qwen"),
        getPref("engine"),
        getPref("sourceLang"),
        getPref("targetLang"),
        getPref("panelMode"),
        getPref("fontSize"),
        getPref("chatModel"),
        getPref("ttsProvider"),
        getPref("ttsRate"),
        getPref("ttsVoice"),
        getPref("ttsMuted"),
      ]);
      setState({
        sonioxKey: sonioxKey ?? "",
        openaiKey: openaiKey ?? "",
        qwenKey: qwenKey ?? "",
        engine: engine === "openai" || engine === "qwen" ? engine : "soniox",
        sourceLang: sourceLang ?? DEFAULT_STATE.sourceLang,
        targetLang: targetLang ?? DEFAULT_STATE.targetLang,
        panelMode: panelMode === "dual" ? "dual" : "single",
        fontSize: fontSize
          ? parseInt(fontSize, 10) || DEFAULT_STATE.fontSize
          : DEFAULT_STATE.fontSize,
        chatModel: chatModel || DEFAULT_STATE.chatModel,
        ttsProvider:
          ttsProvider === "edge"
            ? "edge"
            : ttsProvider === "device"
              ? "device"
              : "none",
        ttsRate: ttsRate
          ? parseInt(ttsRate, 10) || DEFAULT_STATE.ttsRate
          : DEFAULT_STATE.ttsRate,
        ttsVoice: ttsVoice ?? "",
        ttsMuted: ttsMuted === "true",
        loaded: true,
      });
    })();
  }, []);

  const setSonioxKey = async (v: string) => {
    await setSecureKey("soniox", v);
    setState((s) => ({ ...s, sonioxKey: v }));
  };
  const setOpenaiKey = async (v: string) => {
    await setSecureKey("openai", v);
    setState((s) => ({ ...s, openaiKey: v }));
  };
  const setQwenKey = async (v: string) => {
    await setSecureKey("qwen", v);
    setState((s) => ({ ...s, qwenKey: v }));
  };
  const setEngine = (v: Engine) => {
    setState((s) => ({ ...s, engine: v }));
    setPref("engine", v).catch(() => {});
  };
  const setSourceLang = (v: LangCode) => {
    setState((s) => ({ ...s, sourceLang: v }));
    setPref("sourceLang", v).catch(() => {});
  };
  const setTargetLang = (v: LangCode) => {
    setState((s) => ({ ...s, targetLang: v }));
    setPref("targetLang", v).catch(() => {});
  };
  const setPanelMode = (v: PanelMode) => {
    setState((s) => ({ ...s, panelMode: v }));
    setPref("panelMode", v).catch(() => {});
  };
  const setFontSize = (v: number) => {
    setState((s) => ({ ...s, fontSize: v }));
    setPref("fontSize", String(v)).catch(() => {});
  };
  const setChatModel = (v: string) => {
    setState((s) => ({ ...s, chatModel: v }));
    setPref("chatModel", v).catch(() => {});
  };
  const setTTSProvider = (v: TTSProvider) => {
    setState((s) => ({ ...s, ttsProvider: v }));
    setPref("ttsProvider", v).catch(() => {});
  };
  const setTTSRate = (v: number) => {
    setState((s) => ({ ...s, ttsRate: v }));
    setPref("ttsRate", String(v)).catch(() => {});
  };
  const setTTSVoice = (v: string) => {
    setState((s) => ({ ...s, ttsVoice: v }));
    setPref("ttsVoice", v).catch(() => {});
  };
  const setTTSMuted = (v: boolean) => {
    setState((s) => ({ ...s, ttsMuted: v }));
    setPref("ttsMuted", String(v)).catch(() => {});
  };

  return (
    <SettingsContext.Provider
      value={{
        ...state,
        setSonioxKey,
        setOpenaiKey,
        setQwenKey,
        setEngine,
        setSourceLang,
        setTargetLang,
        setPanelMode,
        setFontSize,
        setChatModel,
        setTTSProvider,
        setTTSRate,
        setTTSVoice,
        setTTSMuted,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
