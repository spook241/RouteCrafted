import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "./Badge";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/lib/theme";

interface Trip {
  id: string;
  destination: string;
  country?: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Props {
  trip: Trip;
  onPress: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TripCard({ trip, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {/* Destination row */}
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <Text style={styles.destination} numberOfLines={1}>
            {trip.destination}
          </Text>
          {trip.country ? (
            <Text style={styles.country} numberOfLines={1}>
              {trip.country}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.outline} />
      </View>

      {/* Date range */}
      <Text style={styles.dates}>
        {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
      </Text>

      {/* Status badge */}
      <View style={styles.footer}>
        <StatusBadge status={trip.status as "draft" | "active" | "completed" | "planned"} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    ...Shadows.card,
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  titleArea: {
    flex: 1,
  },
  destination: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
  },
  country: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  dates: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.sm,
  },
  footer: {
    marginTop: Spacing.md,
  },
});
