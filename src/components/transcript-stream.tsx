import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import type { PanelMode, TranscriptRow } from "@/src/types";

interface Props {
  rows: TranscriptRow[];
  fontSize: number;
  panelMode: PanelMode;
}

export function TranscriptStream({ rows, fontSize, panelMode }: Props) {
  const listRef = useRef<FlatList<TranscriptRow>>(null);
  // When the user manually scrolls up, suspend auto-scroll until they tap
  // the "Jump to live" pill or scroll back to the bottom themselves.
  const [autoFollow, setAutoFollow] = useState(true);

  useEffect(() => {
    if (!autoFollow || rows.length === 0) return;
    // Defer to after layout so the new row's height is measured.
    const id = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(id);
  }, [rows.length, autoFollow]);

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        renderItem={({ item }) => (
          <Row row={item} fontSize={fontSize} dual={panelMode === "dual"} />
        )}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
          // Re-enable auto-follow once user is within ~40pt of the bottom.
          setAutoFollow(distFromBottom < 40);
        }}
        scrollEventThrottle={32}
      />
      {!autoFollow && rows.length > 0 ? (
        <View className="absolute bottom-3 left-0 right-0 items-center">
          <Pressable
            onPress={() => {
              setAutoFollow(true);
              listRef.current?.scrollToEnd({ animated: true });
            }}
            className="bg-zinc-900/90 dark:bg-white/90 rounded-full px-4 py-2"
          >
            <Text className="text-white dark:text-zinc-900 text-sm font-medium">
              ↓ Jump to live
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Row({
  row,
  fontSize,
  dual,
}: {
  row: TranscriptRow;
  fontSize: number;
  dual: boolean;
}) {
  return (
    <View className="mb-3">
      {dual && row.source ? (
        <Text
          className="text-zinc-500 dark:text-zinc-400 mb-1"
          style={{ fontSize: Math.max(12, fontSize - 4) }}
        >
          {row.source}
        </Text>
      ) : null}
      {row.translation ? (
        <Text
          className={
            row.isProvisional
              ? "text-zinc-500 dark:text-zinc-400 italic"
              : "text-zinc-900 dark:text-zinc-100"
          }
          style={{ fontSize }}
        >
          {row.translation}
        </Text>
      ) : null}
    </View>
  );
}
