import { Pressable, Text } from "react-native";

// Minimal circular back affordance: a soft-filled tappable disc with a single
// chevron. ~44pt hit target so traditional tap-to-go-back is reliable and
// doesn't depend on the edge-swipe gesture.
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Back"
      className="w-9 h-9 rounded-full items-center justify-center bg-zinc-100 dark:bg-zinc-800 active:opacity-60"
    >
      <Text className="text-zinc-900 dark:text-zinc-100 text-xl leading-none -mt-0.5">
        ‹
      </Text>
    </Pressable>
  );
}
