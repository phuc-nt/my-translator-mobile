export type Engine = "soniox" | "openai";

export type LangCode = string;

export type SessionStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "stopping"
  | "error";

export type PanelMode = "single" | "dual";

export interface TranscriptRow {
  id: string;
  source?: string;
  translation: string;
  isProvisional?: boolean;
  timestamp: number;
}

export interface SessionMeta {
  id: string;
  createdAt: number;
  engine: Engine;
  targetLang: LangCode;
  rowCount: number;
  preview: string;
  name?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SavedSession {
  meta: SessionMeta;
  rows: TranscriptRow[];
  summary?: string;
  chat?: ChatMessage[];
}
