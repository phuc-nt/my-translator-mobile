import { Link } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { TranscriptStream } from "@/src/components/transcript-stream";
import { useSession } from "@/src/state/session-context";
import { useSettings } from "@/src/state/settings-context";

const FONT_MIN = 14;
const FONT_MAX = 32;

export default function TranslateScreen() {
  const { status, rows, errorMessage, muted, start, stop, clear, setMuted } =
    useSession();
  const {
    engine,
    sourceLang,
    targetLang,
    fontSize,
    panelMode,
    sonioxKey,
    openaiKey,
    loaded,
    setFontSize,
    setPanelMode,
  } = useSettings();

  const isLive = status === "streaming" || status === "connecting";
  const requiredKey = engine === "soniox" ? sonioxKey : openaiKey;

  // First-launch: if settings are loaded and the active engine has no key,
  // bounce the user to Settings so they can paste one before anything else.
  useEffect(() => {
    if (loaded && !requiredKey) {
      router.push("/settings");
    }
  }, [loaded, requiredKey]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950" edges={["top"]}>
      <Header
        engine={engine}
        sourceLang={sourceLang}
        targetLang={targetLang}
        status={status}
        showMute={engine === "openai"}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
      />

      <View className="flex-row items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setPanelMode(panelMode === "single" ? "dual" : "single")}
            className="px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700"
          >
            <Text className="text-zinc-700 dark:text-zinc-300 text-xs">
              {panelMode === "dual" ? "Single panel" : "Dual panel"}
            </Text>
          </Pressable>
          <Pressable
            onPress={clear}
            disabled={rows.length === 0}
            className={
              rows.length === 0
                ? "px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 opacity-50"
                : "px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700"
            }
          >
            <Text className="text-zinc-700 dark:text-zinc-300 text-xs">Clear</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2">
          <FontButton
            label="A−"
            onPress={() => setFontSize(Math.max(FONT_MIN, fontSize - 2))}
          />
          <Text className="text-zinc-500 dark:text-zinc-400 text-xs w-7 text-center">
            {fontSize}
          </Text>
          <FontButton
            label="A+"
            onPress={() => setFontSize(Math.min(FONT_MAX, fontSize + 2))}
          />
        </View>
      </View>

      {errorMessage ? (
        <View className="px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-100 dark:border-red-900">
          <Text className="text-red-700 dark:text-red-300 text-xs">{errorMessage}</Text>
        </View>
      ) : null}

      {!loaded ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-zinc-500">Loading…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-zinc-500 text-center">
            {requiredKey
              ? "Tap Start to begin translating."
              : "Add an API key in Settings to get started."}
          </Text>
        </View>
      ) : (
        <TranscriptStream rows={rows} fontSize={fontSize} panelMode={panelMode} />
      )}

      <View className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
        <Pressable
          onPress={() => (isLive ? stop() : start())}
          className={
            isLive
              ? "h-16 rounded-2xl items-center justify-center bg-red-600 active:bg-red-700"
              : "h-16 rounded-2xl items-center justify-center bg-zinc-900 dark:bg-white active:opacity-80"
          }
        >
          <Text
            className={
              isLive
                ? "text-white text-lg font-semibold"
                : "text-white dark:text-zinc-900 text-lg font-semibold"
            }
          >
            {isLive ? "Stop" : "Start"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header({
  engine,
  sourceLang,
  targetLang,
  status,
  showMute,
  muted,
  onToggleMute,
}: {
  engine: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  showMute: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const dot =
    status === "streaming"
      ? "w-2 h-2 rounded-full bg-green-500"
      : status === "connecting"
        ? "w-2 h-2 rounded-full bg-yellow-500"
        : status === "error"
          ? "w-2 h-2 rounded-full bg-red-500"
          : "w-2 h-2 rounded-full bg-zinc-400";
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
      <View className="flex-row items-center gap-2">
        <View className={dot} />
        <Text className="text-zinc-900 dark:text-zinc-100 font-medium">
          {engine === "soniox" ? "Soniox" : "OpenAI"} · auto → {targetLang}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        {showMute ? (
          <Pressable onPress={onToggleMute} hitSlop={8}>
            <Text className="text-2xl">{muted ? "🔇" : "🔊"}</Text>
          </Pressable>
        ) : null}
        <Link href="/settings" asChild>
          <Pressable hitSlop={8}>
            <Text className="text-zinc-900 dark:text-zinc-100 text-2xl">⚙️</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function FontButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-9 h-7 rounded-md border border-zinc-300 dark:border-zinc-700 items-center justify-center"
    >
      <Text className="text-zinc-700 dark:text-zinc-300 text-xs font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
