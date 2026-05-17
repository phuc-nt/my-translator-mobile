import { Pressable, Text, View } from "react-native";

export type DetailTab = "transcript" | "summary" | "chat";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "transcript", label: "Transcript" },
  { key: "summary", label: "Summary" },
  { key: "chat", label: "Chat" },
];

export function DetailTabBar({
  value,
  onChange,
}: {
  value: DetailTab;
  onChange: (t: DetailTab) => void;
}) {
  return (
    <View className="flex-row gap-2 px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
      {TABS.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className={
              active
                ? "px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white"
                : "px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700"
            }
          >
            <Text
              className={
                active
                  ? "text-white dark:text-zinc-900 text-sm font-medium"
                  : "text-zinc-700 dark:text-zinc-300 text-sm"
              }
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
