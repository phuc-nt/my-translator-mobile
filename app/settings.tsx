import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { router } from "expo-router";

import { useEffect, useState } from "react";

import { BackButton } from "@/src/components/back-button";
import { LangDropdown } from "@/src/components/lang-dropdown";
import { SettingsFooter } from "@/src/components/settings-footer";
import { type UpdateResult, checkAndApplyUpdate } from "@/src/lib/ota-update";
import {
  OPENAI_LANGS,
  QWEN_LANGS,
  SONIOX_LANGS,
  type Language,
} from "@/src/lib/languages";
import { clearAllPrefs, clearAllSecureKeys } from "@/src/lib/secure-keys";
import { getVoicesForLang, getDefaultVoice } from "@/src/lib/edge-tts-voices";
import { useSettings } from "@/src/state/settings-context";
import type { Engine } from "@/src/types";

// Assistant model lists per engine. OpenAI-backed engines (soniox/openai) use
// GPT chat models for summary / auto-name. Qwen uses DashScope chat models so
// users with only a Qwen key still get summary features.
const OPENAI_CHAT_MODELS = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini"];
const QWEN_CHAT_MODELS = ["qwen-plus", "qwen-max", "qwen-turbo"];

function langsForEngine(engine: Engine): Language[] {
  if (engine === "soniox") return SONIOX_LANGS;
  if (engine === "openai") return OPENAI_LANGS;
  return QWEN_LANGS;
}

function chatModelsForEngine(engine: Engine): string[] {
  return engine === "qwen" ? QWEN_CHAT_MODELS : OPENAI_CHAT_MODELS;
}

export default function SettingsScreen() {
  const {
    sonioxKey,
    openaiKey,
    qwenKey,
    engine,
    sourceLang,
    targetLang,
    chatModel,
    ttsProvider,
    ttsRate,
    ttsVoice,
    setSonioxKey,
    setOpenaiKey,
    setQwenKey,
    setEngine,
    setSourceLang,
    setTargetLang,
    setChatModel,
    setTTSProvider,
    setTTSRate,
    setTTSVoice,
  } = useSettings();

  const langs: Language[] = langsForEngine(engine);
  const chatModels = chatModelsForEngine(engine);

  // Keep chatModel valid for the active engine. Switching from openai/soniox
  // to qwen (or vice versa) auto-snaps to the new engine's first model so
  // summary/chat route to the correct provider without manual re-selection.
  useEffect(() => {
    if (!chatModels.includes(chatModel)) {
      setChatModel(chatModels[0]);
    }
  }, [chatModels, chatModel, setChatModel]);

  const activeChatModel = chatModels.includes(chatModel)
    ? chatModel
    : chatModels[0];

  return (
    <SafeAreaView
      className="flex-1 bg-white dark:bg-zinc-950"
      edges={["top", "bottom"]}
    >
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <BackButton onPress={() => router.back()} />
        <Text className="text-zinc-900 dark:text-zinc-100 text-lg font-semibold">
          Settings
        </Text>
      </View>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
      <ScrollView
        className="flex-1 px-4 py-4"
        contentContainerClassName="gap-5 pb-24"
        keyboardShouldPersistTaps="handled"
      >
        <Section title="Engine">
          <Row>
            <Choice
              label="Soniox"
              active={engine === "soniox"}
              onPress={() => setEngine("soniox")}
            />
            <Choice
              label="OpenAI"
              active={engine === "openai"}
              onPress={() => setEngine("openai")}
            />
            <Choice
              label="Qwen"
              active={engine === "qwen"}
              onPress={() => setEngine("qwen")}
            />
          </Row>
          <Text className="text-zinc-500 text-xs mt-1">
            {engine === "soniox"
              ? "Soniox · ~$0.12/hr · text-only"
              : engine === "openai"
                ? "OpenAI Realtime · ~$4/hr · most natural translation"
                : "Qwen Live Flash · free preview · fastest, 60+ langs"}
          </Text>
        </Section>

        <Section title="Source language">
          <LangDropdown
            value={sourceLang}
            onChange={setSourceLang}
            langs={langs}
            placeholder="Select source language"
          />
        </Section>

        <Section title="Target language">
          <LangDropdown
            value={targetLang}
            onChange={setTargetLang}
            langs={langs}
            placeholder="Select target language"
          />
        </Section>

        {engine === "soniox" ? (
          <Section title="Soniox API key">
            <TextInput
              value={sonioxKey}
              onChangeText={setSonioxKey}
              placeholder="paste here"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100"
            />
          </Section>
        ) : null}

        {engine === "openai" ? (
          <Section title="OpenAI API key">
            <TextInput
              value={openaiKey}
              onChangeText={setOpenaiKey}
              placeholder="sk-…"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100"
            />
            <Text className="text-zinc-500 text-xs mt-1">
              Billed to your key. OpenAI Realtime ≈ $4/hr.
            </Text>
          </Section>
        ) : null}

        {engine === "qwen" ? (
          <Section title="Qwen (DashScope) API key">
            <TextInput
              value={qwenKey}
              onChangeText={setQwenKey}
              placeholder="sk-…"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100"
            />
            <Text className="text-zinc-500 text-xs mt-1">
              Get a key at Alibaba Cloud Model Studio (Singapore region). Qwen
              Live Flash is in free preview — pricing may change once it leaves
              preview. Pick a source language above; auto-detect is unreliable.
            </Text>
          </Section>
        ) : null}

        <Section title="Assistant model">
          <Row>
            {chatModels.map((m) => (
              <Choice
                key={m}
                label={m}
                active={activeChatModel === m}
                onPress={() => setChatModel(m)}
              />
            ))}
          </Row>
          <Text className="text-zinc-500 text-xs mt-1">
            {engine === "qwen"
              ? "Used for summary, chat, and auto-naming. Runs on your DashScope key."
              : "Used for summary, chat, and auto-naming. Runs on your OpenAI key."}
          </Text>
        </Section>

        <Section title="Text-to-Speech">
          <Row>
            <Choice
              label="Off"
              active={ttsProvider === "none"}
              onPress={() => setTTSProvider("none")}
            />
            <Choice
              label="Device"
              active={ttsProvider === "device"}
              onPress={() => setTTSProvider("device")}
            />
            <Choice
              label="Edge TTS"
              active={ttsProvider === "edge"}
              onPress={() => setTTSProvider("edge")}
            />
          </Row>
          {ttsProvider === "edge" ? (
            <EdgeVoicePicker
              targetLang={targetLang}
              selectedVoice={ttsVoice}
              onSelect={setTTSVoice}
            />
          ) : null}
          {ttsProvider !== "none" ? (
            <View className="mt-3">
              <Text className="text-zinc-700 dark:text-zinc-300 text-sm mb-2">
                Speed: {ttsRate >= 0 ? `+${ttsRate}%` : `${ttsRate}%`}
              </Text>
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setTTSRate(Math.max(-50, ttsRate - 10))}
                  className="w-10 h-8 rounded border border-zinc-300 dark:border-zinc-700 items-center justify-center"
                >
                  <Text className="text-zinc-700 dark:text-zinc-300">−</Text>
                </Pressable>
                <View className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                  <View
                    className="h-2 bg-zinc-600 dark:bg-zinc-400 rounded-full"
                    style={{ width: `${((ttsRate + 50) / 150) * 100}%` }}
                  />
                </View>
                <Pressable
                  onPress={() => setTTSRate(Math.min(100, ttsRate + 10))}
                  className="w-10 h-8 rounded border border-zinc-300 dark:border-zinc-700 items-center justify-center"
                >
                  <Text className="text-zinc-700 dark:text-zinc-300">+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <Text className="text-zinc-500 text-xs mt-2">
            {ttsProvider === "device"
              ? "Uses iOS native voice. Quality depends on installed voices."
              : ttsProvider === "edge"
                ? "Free Microsoft Edge TTS. Select voice for target language."
                : "Enable to hear translated text spoken aloud."}
          </Text>
        </Section>

        <Section title="App updates">
          <UpdateRow />
        </Section>

        <Pressable
          onPress={() => {
            Alert.alert(
              "Clear all data?",
              "This wipes both API keys and saved preferences.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: async () => {
                    await Promise.all([clearAllSecureKeys(), clearAllPrefs()]);
                    setSonioxKey("");
                    setOpenaiKey("");
                    setQwenKey("");
                  },
                },
              ],
            );
          }}
          className="mt-4 py-3 rounded-lg border border-red-300 dark:border-red-800 items-center"
        >
          <Text className="text-red-600 dark:text-red-400 font-medium">
            Clear all data
          </Text>
        </Pressable>

        <SettingsFooter />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const UPDATE_LABEL: Record<UpdateResult, string> = {
  checking: "Checking…",
  downloading: "Updating…",
  "up-to-date": "You're up to date",
  unsupported: "Not available in this build",
  error: "Check failed — try again",
};

function UpdateRow() {
  const [state, setState] = useState<UpdateResult | null>(null);
  const busy = state === "checking" || state === "downloading";

  return (
    <View>
      <Pressable
        disabled={busy}
        onPress={() => checkAndApplyUpdate(setState)}
        className={
          busy
            ? "py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 items-center opacity-50"
            : "py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 items-center active:opacity-70"
        }
      >
        <Text className="text-zinc-900 dark:text-zinc-100 font-medium">
          Check for updates
        </Text>
      </Pressable>
      {state ? (
        <Text className="text-zinc-500 text-xs mt-1">
          {UPDATE_LABEL[state]}
        </Text>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-zinc-900 dark:text-zinc-100 font-semibold mb-2">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? "px-3 py-2 rounded-lg bg-zinc-900 dark:bg-white"
          : "px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700"
      }
    >
      <Text
        className={
          active
            ? "text-white dark:text-zinc-900 font-medium"
            : "text-zinc-900 dark:text-zinc-100"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EdgeVoicePicker({
  targetLang,
  selectedVoice,
  onSelect,
}: {
  targetLang: string;
  selectedVoice: string;
  onSelect: (v: string) => void;
}) {
  const voices = getVoicesForLang(targetLang);
  const currentVoice = selectedVoice || getDefaultVoice(targetLang);

  return (
    <View className="mt-3">
      <Text className="text-zinc-700 dark:text-zinc-300 text-sm mb-2">
        Voice
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {voices.map((v) => (
          <Pressable
            key={v.id}
            onPress={() => onSelect(v.id)}
            className={
              currentVoice === v.id
                ? "px-3 py-2 rounded-lg bg-zinc-900 dark:bg-white"
                : "px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700"
            }
          >
            <Text
              className={
                currentVoice === v.id
                  ? "text-white dark:text-zinc-900 font-medium"
                  : "text-zinc-900 dark:text-zinc-100"
              }
            >
              {v.name} {v.gender === "male" ? "♂" : "♀"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Re-export so type imports stay co-located with consumers if needed later.
export type { Engine };
