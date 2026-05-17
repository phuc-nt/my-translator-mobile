import Constants from "expo-constants";
import { Linking, Pressable, Text, View } from "react-native";

const AUTHOR_URL = "https://github.com/phuc-nt";
const REPO_URL = "https://github.com/phuc-nt/my-translator-mobile";
const BLOG_URL = "https://phucnt.substack.com/";

function open(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function SettingsFooter() {
  const version = Constants.expoConfig?.version ?? "—";

  return (
    <View className="mt-8 items-center gap-1 pb-6">
      <Pressable onPress={() => open(AUTHOR_URL)} hitSlop={6}>
        <Text className="text-xs text-zinc-500">Built by phuc-nt</Text>
      </Pressable>
      <Pressable onPress={() => open(REPO_URL)} hitSlop={6}>
        <Text className="text-xs text-zinc-500">
          ★ Star on GitHub · open source (MIT)
        </Text>
      </Pressable>
      <Pressable onPress={() => open(BLOG_URL)} hitSlop={6}>
        <Text className="text-xs text-zinc-500">Blog</Text>
      </Pressable>
      <Text className="text-xs text-zinc-500">v{version}</Text>
    </View>
  );
}
