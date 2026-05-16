import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/lib/theme";

interface ItineraryItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string | null;
  estimatedCost: string | null;
  placeCardId: string | null;
}

interface ItineraryDay {
  id: string;
  dayNumber: number;
  date: string;
  weatherSummary: string | null;
  items: ItineraryItem[];
}

interface Props {
  day: ItineraryDay;
  onItemPress: (placeCardId: string) => void;
}

function formatDayDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DayCard({ day, onItemPress }: Props) {
  const items = day.items ?? [];

  return (
    <View style={styles.card}>
      {/* Day header */}
      <View style={styles.dayHeader}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayNumber}>Day {day.dayNumber}</Text>
        </View>
        <Text style={styles.dayDate}>{formatDayDate(day.date)}</Text>
      </View>

      {/* Weather */}
      {day.weatherSummary ? (
        <View style={styles.weatherRow}>
          <Text style={styles.weatherText}>🌤 {day.weatherSummary}</Text>
        </View>
      ) : null}

      {/* Items */}
      {items.length === 0 ? (
        <Text style={styles.emptyItems}>No activities scheduled.</Text>
      ) : (
        <View style={styles.itemsList}>
          {items.map((item, idx) => (
            <View key={item.id}>
              {idx > 0 && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [
                  styles.itemRow,
                  item.placeCardId && pressed && styles.itemPressed,
                ]}
                onPress={() => item.placeCardId && onItemPress(item.placeCardId)}
                disabled={!item.placeCardId}
              >
                <View style={styles.itemLeft}>
                  {item.startTime ? (
                    <Text style={styles.itemTime}>{item.startTime}</Text>
                  ) : null}
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.itemDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  {item.estimatedCost ? (
                    <View style={styles.costChip}>
                      <Text style={styles.costText}>~{item.estimatedCost}</Text>
                    </View>
                  ) : null}
                </View>
                {item.placeCardId ? (
                  <View style={styles.cardLink}>
                    <Text style={styles.cardLinkText}>View</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={Colors.primary}
                    />
                  </View>
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadows.card,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dayBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
  },
  dayNumber: {
    ...Typography.labelMd,
    color: Colors.white,
    fontSize: 12,
  },
  dayDate: {
    ...Typography.titleSm,
    color: Colors.onSurfaceVariant,
  },
  weatherRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  weatherText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  emptyItems: {
    ...Typography.bodyMd,
    color: Colors.outline,
    padding: Spacing.lg,
    textAlign: "center",
  },
  itemsList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant,
    marginVertical: Spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemLeft: {
    flex: 1,
    gap: 3,
  },
  itemTime: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemTitle: {
    ...Typography.titleSm,
    color: Colors.onSurface,
  },
  itemDesc: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  costChip: {
    alignSelf: "flex-start",
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: 3,
  },
  costText: {
    ...Typography.labelSm,
    color: Colors.onSurfaceVariant,
  },
  cardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingTop: 2,
  },
  cardLinkText: {
    ...Typography.labelSm,
    color: Colors.primary,
    fontSize: 12,
  },
});
