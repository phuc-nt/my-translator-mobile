import { View } from "react-native";

import { TranscriptStream } from "@/src/components/transcript-stream";
import { useSettings } from "@/src/state/settings-context";
import type { TranscriptRow } from "@/src/types";

export function DetailTranscriptTab({ rows }: { rows: TranscriptRow[] }) {
  const { fontSize } = useSettings();
  return (
    <View className="flex-1">
      <TranscriptStream rows={rows} fontSize={fontSize} panelMode="single" />
    </View>
  );
}
