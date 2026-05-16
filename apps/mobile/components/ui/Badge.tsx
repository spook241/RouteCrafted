import { View, Text, StyleSheet } from "react-native";
import { Colors, Radius, Spacing, Typography } from "@/lib/theme";

type StatusVariant = "draft" | "active" | "completed" | "planned";
type VerdictVariant = "worth_it" | "skip_it" | "depends";

interface StatusBadgeProps {
  status: StatusVariant;
}

interface VerdictBadgeProps {
  verdict: VerdictVariant;
}

const STATUS_CONFIG: Record<
  StatusVariant,
  { bg: string; text: string; label: string }
> = {
  draft: { bg: Colors.statusDraftBg, text: Colors.statusDraftText, label: "Draft" },
  active: { bg: Colors.statusActiveBg, text: Colors.statusActiveText, label: "Active" },
  completed: { bg: Colors.statusCompletedBg, text: Colors.statusCompletedText, label: "Completed" },
  planned: { bg: Colors.statusPlannedBg, text: Colors.statusPlannedText, label: "Planned" },
};

const VERDICT_CONFIG: Record<
  VerdictVariant,
  { bg: string; text: string; label: string; icon: string }
> = {
  worth_it: { bg: Colors.worthItBg, text: Colors.worthItText, label: "Worth It", icon: "✓" },
  skip_it: { bg: Colors.skipItBg, text: Colors.skipItText, label: "Skip It", icon: "✗" },
  depends: { bg: Colors.dependsBg, text: Colors.dependsText, label: "Depends", icon: "~" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      <Text style={[styles.pillText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.depends;
  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      <Text style={[styles.pillText, { color: config.text }]}>
        {config.icon} {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: "flex-start",
  },
  pillText: {
    ...Typography.labelSm,
    fontSize: 12,
  },
});
