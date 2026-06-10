import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/src/components/icon-button";
import { SessionSummary } from "@/src/components/session-summary";
import { TranscriptStream } from "@/src/components/transcript-stream";
import { formatTranscript } from "@/src/lib/transcript-format";
import { useSession } from "@/src/state/session-context";
import { useSettings } from "@/src/state/settings-context";
import { ENGINE_LABELS, type Engine, engineHasVoice } from "@/src/types";

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
    qwenKey,
    loaded,
    setFontSize,
    setPanelMode,
    ttsProvider,
    ttsMuted,
    setTTSMuted,
  } = useSettings();

  const isLive = status === "streaming" || status === "connecting";
  const requiredKey =
    engine === "soniox"
      ? sonioxKey
      : engine === "openai"
        ? openaiKey
        : qwenKey;
  const canShare = rows.length > 0 && !isLive;

  const onShare = async () => {
    try {
      await Share.share({ message: formatTranscript(rows) });
    } catch {
      /* user dismissed or share unavailable */
    }
  };

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(formatTranscript(rows));
    } catch {
      /* clipboard unavailable */
    }
  };

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
        showMute={engineHasVoice(engine)}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
        showTTSMute={ttsProvider === "edge"}
        ttsMuted={ttsMuted}
        onToggleTTSMute={() => setTTSMuted(!ttsMuted)}
      />

      <View className="flex-row items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
        <View className="flex-row items-center gap-2">
          {engine === "qwen" ? null : (
            <Pressable
              onPress={() => setPanelMode(panelMode === "single" ? "dual" : "single")}
              className="px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700"
            >
              <Text className="text-zinc-700 dark:text-zinc-300 text-xs">
                {panelMode === "dual" ? "Single panel" : "Dual panel"}
              </Text>
            </Pressable>
          )}
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
          <Pressable
            onPress={onCopy}
            disabled={!canShare}
            className={
              !canShare
                ? "px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 opacity-50"
                : "px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700"
            }
          >
            <Text className="text-zinc-700 dark:text-zinc-300 text-xs">Copy</Text>
          </Pressable>
          <Pressable
            onPress={onShare}
            disabled={!canShare}
            className={
              !canShare
                ? "px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 opacity-50"
                : "px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-700"
            }
          >
            <Text className="text-zinc-700 dark:text-zinc-300 text-xs">Share</Text>
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
        <TranscriptStream
          rows={rows}
          fontSize={fontSize}
          panelMode={engine === "qwen" ? "single" : panelMode}
        />
      )}

      {status === "idle" && rows.some((r) => !r.isProvisional && r.translation) ? (
        <SessionSummary />
      ) : null}

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
  showTTSMute,
  ttsMuted,
  onToggleTTSMute,
}: {
  engine: Engine;
  sourceLang: string;
  targetLang: string;
  status: string;
  showMute: boolean;
  muted: boolean;
  onToggleMute: () => void;
  showTTSMute: boolean;
  ttsMuted: boolean;
  onToggleTTSMute: () => void;
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
          {ENGINE_LABELS[engine]} · {sourceLang} → {targetLang}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {showTTSMute ? (
          <IconButton
            glyph={ttsMuted ? "♪" : "♫"}
            label={ttsMuted ? "TTS Off" : "TTS On"}
            onPress={onToggleTTSMute}
          />
        ) : null}
        {showMute ? (
          <IconButton
            glyph={muted ? "M" : "▶"}
            label={muted ? "Unmute" : "Mute"}
            onPress={onToggleMute}
          />
        ) : null}
        <IconButton
          glyph="H"
          label="History"
          onPress={() => router.push("/history")}
        />
        <IconButton
          glyph="S"
          label="Settings"
          onPress={() => router.push("/settings")}
        />
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
