import { MAX_INPUT_CHARS } from "@/src/lib/openai-chat";
import { formatTranscript } from "@/src/lib/transcript-format";
import type { TranscriptRow } from "@/src/types";

// Token economy: a generated summary is a dense stand-in for the whole
// session, so prefer it when present. Otherwise fall back to the transcript,
// truncated to the most recent slice that fits the model input budget.
export function buildChatContext(
  rows: TranscriptRow[],
  summary?: string,
): string {
  if (summary && summary.trim()) return summary.trim().slice(0, MAX_INPUT_CHARS);
  const text = formatTranscript(rows);
  return text.length > MAX_INPUT_CHARS ? text.slice(-MAX_INPUT_CHARS) : text;
}
