import type { ChatMessage, TranscriptRow } from "@/src/types";

// Caps keep each Keychain value well under the OS per-item ceiling. We persist
// only finals (no provisional), newest rows win, and long fields are trimmed.
export const MAX_SESSIONS = 20;
export const MAX_ROWS_PERSIST = 120;
export const MAX_FIELD_CHARS = 600;
export const PREVIEW_CHARS = 80;
// Summaries are paragraphs, not single fields — larger cap than MAX_FIELD_CHARS
// but still well under the Keychain per-item ceiling.
export const MAX_SUMMARY_CHARS = 2000;
// Chat is a whole conversation, not one field — ~3x the summary cap, still
// well under the Keychain per-item ceiling. Oldest turns are dropped on save.
export const MAX_CHAT_CHARS = 6000;

export interface Blob {
  rows: TranscriptRow[];
  summary?: string;
  chat?: ChatMessage[];
}

// Blobs were originally stored as a bare TranscriptRow[]. New blobs are an
// envelope { rows, summary?, chat? }. Detect shape so old sessions keep loading.
export function normalizeBlob(parsed: unknown): Blob | null {
  if (Array.isArray(parsed)) return { rows: parsed as TranscriptRow[] };
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Blob).rows)
  ) {
    const b = parsed as Blob;
    return {
      rows: b.rows,
      summary: b.summary,
      chat: Array.isArray(b.chat) ? b.chat : undefined,
    };
  }
  return null;
}

// Keep the conversation under MAX_CHAT_CHARS by dropping the OLDEST turns
// first (recent context matters most). Always keeps at least the last message.
export function capChat(messages: ChatMessage[]): ChatMessage[] {
  const arr = [...messages];
  while (JSON.stringify(arr).length > MAX_CHAT_CHARS && arr.length > 1) {
    arr.shift();
  }
  return arr;
}

export function trimField(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  return v.length > MAX_FIELD_CHARS ? v.slice(0, MAX_FIELD_CHARS) : v;
}

export function sanitizeRows(rows: TranscriptRow[]): TranscriptRow[] {
  const finals = rows.filter((r) => !r.isProvisional && r.translation);
  const recent =
    finals.length > MAX_ROWS_PERSIST
      ? finals.slice(finals.length - MAX_ROWS_PERSIST)
      : finals;
  return recent.map((r) => ({
    id: r.id,
    source: trimField(r.source),
    translation: trimField(r.translation) ?? "",
    timestamp: r.timestamp,
  }));
}
