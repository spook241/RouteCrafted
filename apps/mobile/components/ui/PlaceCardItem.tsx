import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { VerdictBadge } from "./Badge";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/lib/theme";

interface PlaceCard {
  id: string;
  placeName: string;
  category: string;
  verdict: "worth_it" | "skip_it" | "depends";
  estimatedCost: string | null;
  summary: string | null;
}

interface Props {
  card: PlaceCard;
  onPress: () => void;
}

export function PlaceCardItem({ card, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>
            {card.placeName}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {card.category}
          </Text>
          <View style={styles.metaRow}>
            <VerdictBadge verdict={card.verdict} />
            {card.estimatedCost ? (
              <View style={styles.costChip}>
                <Text style={styles.costText}>{card.estimatedCost}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.outline} />
      </View>
      {card.summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {card.summary}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  name: {
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  category: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textTransform: "capitalize",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginTop: Spacing.xs,
  },
  costChip: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  costText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  summary: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
});
