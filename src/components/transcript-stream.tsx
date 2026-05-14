import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import type { PanelMode, TranscriptRow } from "@/src/types";

interface Props {
  rows: TranscriptRow[];
  fontSize: number;
  panelMode: PanelMode;
}

// Dual panel for portrait mobile: two stacked fixed-height regions that scroll
// independently. Vertical split (not columns) — columns wrap badly with 22pt
// text on a phone. Source = 40% (smaller font), target = 60% (full font).
//
// Reading order: chronological (oldest on top, newest at bottom). Provisional
// pinned at the bottom so the live, in-flight text is always under the most
// recent final — matches a chat/transcript reading flow.
export function TranscriptStream({ rows, fontSize, panelMode }: Props) {
  const provisional = useMemo(
    () => rows.filter((r) => r.isProvisional),
    [rows],
  );
  const finals = useMemo(
    () => rows.filter((r) => !r.isProvisional),
    [rows],
  );

  if (panelMode === "dual") {
    return <DualPanel rows={rows} finals={finals} provisional={provisional} fontSize={fontSize} />;
  }
  return <SinglePanel finals={finals} provisional={provisional} fontSize={fontSize} />;
}

function SinglePanel({
  finals,
  provisional,
  fontSize,
}: {
  finals: TranscriptRow[];
  provisional: TranscriptRow[];
  fontSize: number;
}) {
  const ordered = useMemo(
    () => [...finals, ...provisional],
    [finals, provisional],
  );
  return (
    <PinnedBottomList
      data={ordered}
      keyExtractor={(r) => r.id}
      renderRow={(item) => <TargetRow row={item} fontSize={fontSize} />}
    />
  );
}

function DualPanel({
  rows,
  finals,
  provisional,
  fontSize,
}: {
  rows: TranscriptRow[];
  finals: TranscriptRow[];
  provisional: TranscriptRow[];
  fontSize: number;
}) {
  const sourceRows = useMemo(
    () => rows.filter((r) => r.source && r.source.length > 0),
    [rows],
  );

  const sourceOrdered = useMemo(() => {
    const prov = sourceRows.filter((r) => r.isProvisional);
    const fin = sourceRows.filter((r) => !r.isProvisional);
    return [...fin, ...prov];
  }, [sourceRows]);

  const targetOrdered = useMemo(() => {
    const prov = provisional.filter((r) => r.translation);
    const fin = finals.filter((r) => r.translation);
    return [...fin, ...prov];
  }, [provisional, finals]);

  const sourceFont = Math.max(12, fontSize - 6);

  return (
    <View className="flex-1">
      {/* Source — 40% */}
      <View style={{ flex: 4 }} className="border-b border-zinc-200 dark:border-zinc-800">
        <PinnedBottomList
          data={sourceOrdered}
          keyExtractor={(r) => `src-${r.id}`}
          renderRow={(item) => <SourceRow row={item} fontSize={sourceFont} />}
        />
      </View>
      {/* Target — 60% */}
      <View style={{ flex: 6 }}>
        <PinnedBottomList
          data={targetOrdered}
          keyExtractor={(r) => `tgt-${r.id}`}
          renderRow={(item) => <TargetRow row={item} fontSize={fontSize} />}
        />
      </View>
    </View>
  );
}

// FlatList that keeps the viewport pinned to the bottom (newest content).
// When user scrolls up, auto-follow suspends until they tap "↓ Live" or
// scroll back within ~40pt of the bottom.
function PinnedBottomList<T extends TranscriptRow>({
  data,
  keyExtractor,
  renderRow,
}: {
  data: T[];
  keyExtractor: (row: T) => string;
  renderRow: (row: T) => React.ReactElement;
}) {
  const listRef = useRef<FlatList<T>>(null);
  const [autoFollow, setAutoFollow] = useState(true);

  // Track whatever changes inside rows (text grows during provisional updates
  // without changing array length) so the auto-scroll effect re-fires as the
  // last row's content keeps expanding.
  const contentKey = data.length === 0
    ? 0
    : data.length * 1000 + (data[data.length - 1]?.translation?.length ?? 0);

  useEffect(() => {
    if (!autoFollow || data.length === 0) return;
    const id = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(id);
  }, [contentKey, autoFollow, data.length]);

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        renderItem={({ item }) => renderRow(item)}
        onContentSizeChange={() => {
          // Final safety net — when the FlatList's content height actually
          // grows (e.g. a row wraps onto a new line) and we're still in
          // follow mode, snap to the bottom regardless of array identity.
          if (autoFollow) listRef.current?.scrollToEnd({ animated: false });
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
          setAutoFollow(distFromBottom < 40);
        }}
        scrollEventThrottle={32}
      />
      {!autoFollow && data.length > 0 ? (
        <View className="absolute bottom-2 left-0 right-0 items-center">
          <Pressable
            onPress={() => {
              setAutoFollow(true);
              listRef.current?.scrollToEnd({ animated: true });
            }}
            className="bg-zinc-900/90 dark:bg-white/90 rounded-full px-3 py-1"
          >
            <Text className="text-white dark:text-zinc-900 text-xs font-medium">
              ↓ Live
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function TargetRow({ row, fontSize }: { row: TranscriptRow; fontSize: number }) {
  if (!row.translation) return <View />;
  return (
    <View className="mb-3">
      <Text className="text-zinc-900 dark:text-zinc-100" style={{ fontSize }}>
        {row.translation}
      </Text>
    </View>
  );
}

function SourceRow({ row, fontSize }: { row: TranscriptRow; fontSize: number }) {
  if (!row.source) return <View />;
  return (
    <View className="mb-2">
      <Text className="text-zinc-600 dark:text-zinc-400" style={{ fontSize }}>
        {row.source}
      </Text>
    </View>
  );
}
