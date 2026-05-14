import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getPref,
  getSecureKey,
  setPref,
  setSecureKey,
} from "@/src/lib/secure-keys";
import type { Engine, LangCode, PanelMode } from "@/src/types";

interface SettingsState {
  sonioxKey: string;
  openaiKey: string;
  engine: Engine;
  sourceLang: LangCode;
  targetLang: LangCode;
  panelMode: PanelMode;
  fontSize: number;
  loaded: boolean;
}

interface SettingsActions {
  setSonioxKey: (v: string) => Promise<void>;
  setOpenaiKey: (v: string) => Promise<void>;
  setEngine: (v: Engine) => void;
  setTargetLang: (v: LangCode) => void;
  setPanelMode: (v: PanelMode) => void;
  setFontSize: (v: number) => void;
}

const DEFAULT_STATE: SettingsState = {
  sonioxKey: "",
  openaiKey: "",
  engine: "soniox",
  // Source is always auto-detect — translation at live events shouldn't
  // require the speaker to declare their language up front. Both Soniox
  // ("auto" → no language_hints) and OpenAI Whisper auto-detect natively.
  sourceLang: "auto",
  targetLang: "vi",
  panelMode: "single",
  fontSize: 18,
  loaded: false,
};

const SettingsContext = createContext<(SettingsState & SettingsActions) | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(DEFAULT_STATE);

  useEffect(() => {
    (async () => {
      const [
        sonioxKey,
        openaiKey,
        engine,
        targetLang,
        panelMode,
        fontSize,
      ] = await Promise.all([
        getSecureKey("soniox"),
        getSecureKey("openai"),
        getPref("engine"),
        getPref("targetLang"),
        getPref("panelMode"),
        getPref("fontSize"),
      ]);
      setState({
        sonioxKey: sonioxKey ?? "",
        openaiKey: openaiKey ?? "",
        engine: engine === "openai" ? "openai" : "soniox",
        sourceLang: "auto",
        targetLang: targetLang ?? DEFAULT_STATE.targetLang,
        panelMode: panelMode === "dual" ? "dual" : "single",
        fontSize: fontSize ? parseInt(fontSize, 10) || DEFAULT_STATE.fontSize : DEFAULT_STATE.fontSize,
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
  const setEngine = (v: Engine) => {
    setState((s) => ({ ...s, engine: v }));
    setPref("engine", v).catch(() => {});
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

  return (
    <SettingsContext.Provider
      value={{
        ...state,
        setSonioxKey,
        setOpenaiKey,
        setEngine,
        setTargetLang,
        setPanelMode,
        setFontSize,
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
