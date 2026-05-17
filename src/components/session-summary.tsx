import { Link } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { summarizeTranscript } from "@/src/lib/openai-chat";
import { formatTranscript } from "@/src/lib/transcript-format";
import { useSession } from "@/src/state/session-context";
import { useSettings } from "@/src/state/settings-context";
import type { TranscriptRow } from "@/src/types";

// Reusable summary UI. `rows` is the source transcript (caller-provided so it
// works on both the live screen and the History detail view). `initialSummary`
// pre-fills a previously persisted summary; `onSaved` fires when a fresh
// summary is generated so the caller can persist it.
export function SummaryPanel({
  rows,
  initialSummary,
  onSaved,
}: {
  rows: TranscriptRow[];
  initialSummary?: string;
  onSaved?: (text: string) => void;
}) {
  const { openaiKey, targetLang, chatModel } = useSettings();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(
    initialSummary ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  // No key and nothing saved → guide the user. If a saved summary exists we
  // still show it read-only even without a key.
  if (!openaiKey && !summary) {
    return (
      <View className="px-4 pt-2">
        <Text className="text-zinc-500 dark:text-zinc-400 text-xs">
          Add an OpenAI key in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to summarize this session.
        </Text>
      </View>
    );
  }

  const run = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const text = await summarizeTranscript({
        apiKey: openaiKey,
        text: formatTranscript(rows),
        targetLang,
        model: chatModel,
      });
      setSummary(text);
      onSaved?.(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="px-4 pt-2">
      {openaiKey ? (
        <Pressable
          onPress={run}
          disabled={loading}
          className={
            loading
              ? "h-10 rounded-xl items-center justify-center border border-zinc-300 dark:border-zinc-700 opacity-50"
              : "h-10 rounded-xl items-center justify-center border border-zinc-300 dark:border-zinc-700 active:opacity-70"
          }
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-zinc-900 dark:text-zinc-100 text-sm font-medium">
              {summary ? "Summarize again" : "Summarize"}
            </Text>
          )}
        </Pressable>
      ) : null}

      {error ? (
        <Text className="text-red-600 dark:text-red-400 text-xs mt-2">
          {error}
        </Text>
      ) : null}

      {summary ? (
        <ScrollView
          className="mt-2 max-h-48 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3"
          showsVerticalScrollIndicator
        >
          <Text className="text-zinc-800 dark:text-zinc-200 text-sm leading-5">
            {summary}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

// Live-screen wrapper: preserves the original behavior (rows from the active
// session, no persistence).
export function SessionSummary() {
  const { rows } = useSession();
  return <SummaryPanel rows={rows} />;
}
