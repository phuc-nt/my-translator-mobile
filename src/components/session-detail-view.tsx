import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DetailChatTab } from "@/src/components/detail-chat-tab";
import { DetailSummaryTab } from "@/src/components/detail-summary-tab";
import { type DetailTab, DetailTabBar } from "@/src/components/detail-tab-bar";
import { DetailTranscriptTab } from "@/src/components/detail-transcript-tab";
import { RenameSessionModal } from "@/src/components/rename-session-modal";
import { renameSession, saveSummary } from "@/src/lib/history-store";
import { suggestSessionTitle } from "@/src/lib/openai-chat";
import { formatTranscript } from "@/src/lib/transcript-format";
import { useSettings } from "@/src/state/settings-context";
import type { SavedSession } from "@/src/types";

export function SessionDetailView({
  session,
  onBack,
  onChanged,
}: {
  session: SavedSession;
  onBack: () => void;
  onChanged: () => void;
}) {
  const { openaiKey, targetLang, chatModel } = useSettings();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(session.meta.name);
  const [summary, setSummary] = useState(session.summary);
  const [tab, setTab] = useState<DetailTab>("transcript");
  const [autoNaming, setAutoNaming] = useState(false);

  const submitRename = async (next: string) => {
    setRenaming(false);
    await renameSession(session.meta.id, next);
    setName(next.trim() || undefined);
    onChanged();
  };

  const autoName = async () => {
    if (autoNaming || !openaiKey) return;
    setAutoNaming(true);
    try {
      const title = await suggestSessionTitle({
        apiKey: openaiKey,
        text: summary && summary.trim() ? summary : formatTranscript(session.rows),
        targetLang,
        model: chatModel,
      });
      if (title) {
        await renameSession(session.meta.id, title);
        setName(title);
        onChanged();
      }
    } catch {
      /* surfaced minimally: a failed auto-name just leaves the name as-is */
    } finally {
      setAutoNaming(false);
    }
  };

  const onSummarySaved = async (text: string) => {
    setSummary(text);
    const ok = await saveSummary(session.meta.id, text);
    // Keep the displayed summary in sync with what actually persisted: if the
    // write failed, drop it so a reopen doesn't silently lose it without notice.
    if (!ok) setSummary(session.summary);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-zinc-950"
      edges={["bottom"]}
    >
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Pressable onPress={onBack} hitSlop={8}>
          <Text className="text-zinc-900 dark:text-zinc-100 text-base">
            ‹ Back
          </Text>
        </Pressable>
        <View className="flex-row items-center gap-4">
          {openaiKey ? (
            <Pressable onPress={autoName} disabled={autoNaming} hitSlop={8}>
              {autoNaming ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="text-zinc-900 dark:text-zinc-100 text-sm">
                  Auto-name
                </Text>
              )}
            </Pressable>
          ) : null}
          <Pressable onPress={() => setRenaming(true)} hitSlop={8}>
            <Text className="text-zinc-900 dark:text-zinc-100 text-sm">
              Rename
            </Text>
          </Pressable>
          <Text className="text-zinc-500 dark:text-zinc-400 text-xs">
            {session.meta.rowCount} lines
          </Text>
        </View>
      </View>
      {name ? (
        <Text className="px-4 pt-2 text-zinc-900 dark:text-zinc-100 font-medium">
          {name}
        </Text>
      ) : null}

      <DetailTabBar value={tab} onChange={setTab} />

      {tab === "transcript" ? (
        <DetailTranscriptTab rows={session.rows} />
      ) : tab === "summary" ? (
        <DetailSummaryTab
          rows={session.rows}
          initialSummary={summary}
          onSaved={onSummarySaved}
        />
      ) : (
        <DetailChatTab
          sessionId={session.meta.id}
          rows={session.rows}
          summary={summary}
          initialChat={session.chat}
          chatModel={chatModel}
        />
      )}

      <RenameSessionModal
        visible={renaming}
        initialName={name ?? ""}
        onCancel={() => setRenaming(false)}
        onSubmit={submitRename}
      />
    </SafeAreaView>
  );
}
