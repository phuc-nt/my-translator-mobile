import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { buildChatContext } from "@/src/lib/chat-context";
import { chatCompletion, DEFAULT_CHAT_MODEL } from "@/src/lib/openai-chat";
import { saveChat } from "@/src/lib/history-store";
import { useSettings } from "@/src/state/settings-context";
import type { ChatMessage, TranscriptRow } from "@/src/types";

const PRESETS: { label: string; prompt: string }[] = [
  { label: "Summarize", prompt: "Summarize this session concisely." },
  {
    label: "Action items",
    prompt: "Extract the action items and decisions as a bullet list.",
  },
  {
    label: "Key points",
    prompt: "List the key points discussed in this session.",
  },
];

export function DetailChatTab({
  sessionId,
  rows,
  summary,
  initialChat,
  chatModel,
}: {
  sessionId: string;
  rows: TranscriptRow[];
  summary?: string;
  initialChat?: ChatMessage[];
  chatModel?: string;
}) {
  const { openaiKey, targetLang } = useSettings();
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  if (!openaiKey) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-zinc-500 dark:text-zinc-400 text-xs text-center">
          Add an OpenAI key in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to chat about this session.
        </Text>
      </View>
    );
  }

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const prev = messages;
    const next = [...prev, { role: "user", content: trimmed } as ChatMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const context = buildChatContext(rows, summary);
      const reply = await chatCompletion({
        apiKey: openaiKey,
        model: chatModel || DEFAULT_CHAT_MODEL,
        system: `You answer questions about a recorded session. Use ONLY the session content below. If the answer is not in it, say so. Respond in the language with code "${targetLang}".\n\n--- SESSION ---\n${context}`,
        messages: next,
      });
      const withReply = [
        ...next,
        { role: "assistant", content: reply } as ChatMessage,
      ];
      setMessages(withReply);
      saveChat(sessionId, withReply).catch(() => {});
      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        50,
      );
    } catch (e) {
      setError((e as Error).message);
      setMessages(prev);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerClassName="py-3 gap-3"
      >
        {messages.length === 0 ? (
          <Text className="text-zinc-400 dark:text-zinc-500 text-xs">
            Ask anything about this session, or tap a suggestion below.
          </Text>
        ) : null}
        {messages.map((m, i) => (
          <View
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-900 dark:bg-white px-3 py-2"
                : "self-start max-w-[85%] rounded-2xl rounded-bl-sm border border-zinc-200 dark:border-zinc-800 px-3 py-2"
            }
          >
            <Text
              className={
                m.role === "user"
                  ? "text-white dark:text-zinc-900 text-sm leading-5"
                  : "text-zinc-800 dark:text-zinc-200 text-sm leading-5"
              }
            >
              {m.content}
            </Text>
          </View>
        ))}
        {loading ? (
          <View className="self-start px-3 py-2">
            <ActivityIndicator />
          </View>
        ) : null}
        {error ? (
          <Text className="text-red-600 dark:text-red-400 text-xs">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View className="border-t border-zinc-100 dark:border-zinc-900">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 py-2"
          contentContainerClassName="gap-2"
        >
          {PRESETS.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => send(p.prompt)}
              disabled={loading}
              className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 active:opacity-70"
            >
              <Text className="text-zinc-700 dark:text-zinc-300 text-xs">
                {p.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="flex-row items-end gap-2 px-4 pb-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about this session…"
            placeholderTextColor="#9ca3af"
            multiline
            className="flex-1 max-h-24 rounded-2xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm"
          />
          <Pressable
            onPress={() => send(input)}
            disabled={loading || !input.trim()}
            className={
              loading || !input.trim()
                ? "h-10 px-4 rounded-2xl items-center justify-center bg-zinc-300 dark:bg-zinc-700"
                : "h-10 px-4 rounded-2xl items-center justify-center bg-zinc-900 dark:bg-white active:opacity-70"
            }
          >
            <Text className="text-white dark:text-zinc-900 text-sm font-medium">
              Send
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
