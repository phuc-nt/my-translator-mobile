import * as SecureStore from "expo-secure-store";

import {
  MAX_SESSIONS,
  MAX_SUMMARY_CHARS,
  PREVIEW_CHARS,
  type Blob,
  capChat,
  normalizeBlob,
  sanitizeRows,
  trimField,
} from "@/src/lib/history-blob";
import type {
  ChatMessage,
  SavedSession,
  SessionMeta,
  TranscriptRow,
} from "@/src/types";

const INDEX_KEY = "history.index";
const sessionKey = (id: string) => `history.session.${id}`;

async function readIndex(): Promise<SessionMeta[]> {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionMeta[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(index: SessionMeta[]): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

async function deleteBlob(id: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(sessionKey(id));
  } catch {
    /* ignore */
  }
}

// Persist one finished session. Never throws; returns false if the blob could
// not be stored even after shrinking + evicting the oldest session.
export async function saveSession(
  meta: SessionMeta,
  rows: TranscriptRow[],
): Promise<boolean> {
  let sanitized = sanitizeRows(rows);
  if (sanitized.length === 0) return false;

  const first = sanitized[0];
  const finalMeta: SessionMeta = {
    ...meta,
    rowCount: sanitized.length,
    preview: (first.translation || first.source || "").slice(0, PREVIEW_CHARS),
  };

  const stored = await (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await SecureStore.setItemAsync(
          sessionKey(meta.id),
          JSON.stringify({ rows: sanitized } satisfies Blob),
        );
        return true;
      } catch {
        // Shrink (keep newest half) and retry; give up after a few rounds.
        if (sanitized.length <= 1) break;
        sanitized = sanitized.slice(Math.ceil(sanitized.length / 2));
        finalMeta.rowCount = sanitized.length;
      }
    }
    return false;
  })();

  if (!stored) return false;

  const index = await readIndex();
  const next = [finalMeta, ...index.filter((m) => m.id !== meta.id)];
  const evicted = next.splice(MAX_SESSIONS);
  await Promise.all(evicted.map((m) => deleteBlob(m.id)));

  const wroteIndex = await writeIndex(next);
  if (!wroteIndex) {
    await deleteBlob(meta.id);
    return false;
  }
  return true;
}

export async function listSessions(): Promise<SessionMeta[]> {
  return readIndex();
}

export async function getSession(id: string): Promise<SavedSession | null> {
  const index = await readIndex();
  const meta = index.find((m) => m.id === id);
  if (!meta) return null;
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(id));
    if (!raw) return null;
    const blob = normalizeBlob(JSON.parse(raw));
    if (!blob) return null;
    return {
      meta,
      rows: blob.rows,
      summary: blob.summary,
      chat: blob.chat,
    };
  } catch {
    return null;
  }
}

// Update only the index entry's name. Empty/whitespace clears it. Never throws.
export async function renameSession(
  id: string,
  name: string,
): Promise<boolean> {
  try {
    const index = await readIndex();
    const trimmed = trimField(name.trim()) || undefined;
    const next = index.map((m) => (m.id === id ? { ...m, name: trimmed } : m));
    return writeIndex(next);
  } catch {
    return false;
  }
}

// Persist a generated summary alongside the session's rows. Returns false if
// the session blob is missing or cannot be written. Never throws.
export async function saveSummary(
  id: string,
  summary: string,
): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(id));
    if (!raw) return false;
    const blob = normalizeBlob(JSON.parse(raw));
    if (!blob) return false;
    blob.summary = summary.slice(0, MAX_SUMMARY_CHARS);
    await SecureStore.setItemAsync(
      sessionKey(id),
      JSON.stringify(blob satisfies Blob),
    );
    return true;
  } catch {
    return false;
  }
}

// Persist the session chat. Oldest turns are dropped to fit the cap. Returns
// false if the session blob is missing or cannot be written. Never throws.
export async function saveChat(
  id: string,
  messages: ChatMessage[],
): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(id));
    if (!raw) return false;
    const blob = normalizeBlob(JSON.parse(raw));
    if (!blob) return false;
    blob.chat = capChat(messages);
    await SecureStore.setItemAsync(
      sessionKey(id),
      JSON.stringify(blob satisfies Blob),
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteSession(id: string): Promise<void> {
  await deleteBlob(id);
  const index = await readIndex();
  await writeIndex(index.filter((m) => m.id !== id));
}

export async function clearAllHistory(): Promise<void> {
  const index = await readIndex();
  await Promise.all(index.map((m) => deleteBlob(m.id)));
  try {
    await SecureStore.deleteItemAsync(INDEX_KEY);
  } catch {
    /* ignore */
  }
}
