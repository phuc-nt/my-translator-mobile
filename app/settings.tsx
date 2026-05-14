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

import { OPENAI_LANGS, type Language } from "@/src/lib/languages";
import { clearAllPrefs, clearAllSecureKeys } from "@/src/lib/secure-keys";
import { useSettings } from "@/src/state/settings-context";
import type { Engine, LangCode } from "@/src/types";

export default function SettingsScreen() {
  const {
    sonioxKey,
    openaiKey,
    engine,
    targetLang,
    setSonioxKey,
    setOpenaiKey,
    setEngine,
    setTargetLang,
  } = useSettings();

  // Both engines auto-detect source language. Share OpenAI's target list for
  // consistency (Soniox supports the same superset for translation targets).
  const langs: Language[] = OPENAI_LANGS;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950" edges={["bottom"]}>
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
          </Row>
          <Text className="text-zinc-500 text-xs mt-1">
            {engine === "soniox"
              ? "Soniox · ~$0.12/hr · text-only"
              : "OpenAI Realtime · ~$4/hr · text + voice (phase 3)"}
          </Text>
        </Section>

        <Section title="Target language">
          <LangPicker value={targetLang} onChange={setTargetLang} langs={langs} />
          <Text className="text-zinc-500 text-xs mt-1">
            Source language is auto-detected.
          </Text>
        </Section>

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
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

function LangPicker({
  value,
  onChange,
  langs,
}: {
  value: LangCode;
  onChange: (v: LangCode) => void;
  langs: Language[];
}) {
  return (
    <Row>
      {langs.map((l) => (
        <Choice
          key={l.code}
          label={l.name}
          active={value === l.code}
          onPress={() => onChange(l.code)}
        />
      ))}
    </Row>
  );
}

// Re-export so type imports stay co-located with consumers if needed later.
export type { Engine };
