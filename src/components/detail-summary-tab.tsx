import { View } from "react-native";

import { SummaryPanel } from "@/src/components/session-summary";
import type { TranscriptRow } from "@/src/types";

export function DetailSummaryTab({
  rows,
  initialSummary,
  onSaved,
}: {
  rows: TranscriptRow[];
  initialSummary?: string;
  onSaved: (text: string) => void;
}) {
  return (
    <View className="flex-1">
      <SummaryPanel
        rows={rows}
        initialSummary={initialSummary}
        onSaved={onSaved}
      />
    </View>
  );
}
