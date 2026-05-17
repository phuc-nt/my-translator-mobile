import { useFocusEffect, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/src/components/back-button";
import { HistoryListItem } from "@/src/components/history-list-item";
import { HistorySearchBar } from "@/src/components/history-search-bar";
import { SessionDetailView } from "@/src/components/session-detail-view";
import {
  clearAllHistory,
  deleteSession,
  getSession,
  listSessions,
} from "@/src/lib/history-store";
import type { SavedSession, SessionMeta } from "@/src/types";

export default function HistoryScreen() {
  const [metas, setMetas] = useState<SessionMeta[]>([]);
  const [selected, setSelected] = useState<SavedSession | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return metas;
    return metas.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) ||
        m.preview.toLowerCase().includes(q),
    );
  }, [metas, query]);

  const refresh = useCallback(() => {
    listSessions().then(setMetas);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const open = async (id: string) => {
    const s = await getSession(id);
    if (s) setSelected(s);
  };

  const confirmDelete = (id: string) => {
    Alert.alert("Delete session", "Remove this saved session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteSession(id);
          refresh();
        },
      },
    ]);
  };

  const confirmClearAll = () => {
    Alert.alert("Clear all history", "Delete every saved session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: async () => {
          await clearAllHistory();
          setMetas([]);
        },
      },
    ]);
  };

  if (selected) {
    return (
      <SessionDetailView
        session={selected}
        onBack={() => setSelected(null)}
        onChanged={refresh}
      />
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-zinc-950"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <View className="flex-row items-center gap-3">
          <BackButton onPress={() => router.back()} />
          <Text className="text-zinc-900 dark:text-zinc-100 text-lg font-semibold">
            History
          </Text>
        </View>
        {metas.length > 0 ? (
          <Pressable onPress={confirmClearAll} hitSlop={8}>
            <Text className="text-red-600 dark:text-red-400 text-sm">
              Clear all
            </Text>
          </Pressable>
        ) : null}
      </View>

      {metas.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-zinc-500 text-center">
            No saved sessions yet. Finished translations are saved here
            automatically.
          </Text>
        </View>
      ) : (
        <>
          <HistorySearchBar value={query} onChangeText={setQuery} />
          {filtered.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-zinc-500 text-center">No matches.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <HistoryListItem
                  meta={item}
                  onOpen={() => open(item.id)}
                  onDelete={() => confirmDelete(item.id)}
                />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
