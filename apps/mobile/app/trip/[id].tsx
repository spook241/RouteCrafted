import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { DayCard } from "@/components/ui/DayCard";
import { StatusBadge } from "@/components/ui/Badge";
import { GradientButton } from "@/components/ui/GradientButton";
import { Colors, Radius, Spacing, Shadows, Typography } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

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

interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  days: ItineraryDay[];
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { containerPadding } = useResponsive();

  async function loadTrip() {
    try {
      setError(null);
      const data = await apiFetch<Trip>(`/api/mobile/trips/${id}`);
      setTrip(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trip");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTrip();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Trip not found"}</Text>
        <TouchableOpacity onPress={loadTrip} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const days = trip.days ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { padding: containerPadding, gap: Spacing.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadTrip(); }}
          tintColor={Colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Hero card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Text style={styles.destination}>{trip.destination}</Text>
          <StatusBadge status={trip.status as "draft" | "active" | "completed" | "planned"} />
        </View>
        <View style={styles.datesRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.onSurfaceVariant} />
          <Text style={styles.dates}>
            {new Date(trip.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {" – "}
            {new Date(trip.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>

        {trip.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>{trip.notes}</Text>
          </View>
        ) : null}

        {days.length > 0 && (
          <GradientButton
            variant="outline"
            label="View Place Cards"
            onPress={() => router.push(`/cards/${trip.id}` as "/cards/[tripId]")}
            style={styles.placeCardsBtn}
          />
        )}
      </View>

      {/* Itinerary */}
      {days.length === 0 ? (
        <View style={styles.emptyDays}>
          <Ionicons name="map-outline" size={40} color={Colors.outlineVariant} />
          <Text style={styles.emptyMsg}>
            No itinerary yet. Visit the website to generate your plan.
          </Text>
        </View>
      ) : (
        days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            onItemPress={(placeCardId) =>
              router.push({ pathname: "/card/[id]", params: { id: placeCardId } })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  container: { flex: 1, backgroundColor: Colors.surfaceContainerLow },
  content: {},
  heroCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.card,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  destination: {
    ...Typography.displayMd,
    color: Colors.onSurface,
    flex: 1,
  },
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  dates: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  notesCard: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  notesText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, fontStyle: "italic" },
  placeCardsBtn: { marginTop: Spacing.xs },
  emptyDays: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyMsg: {
    ...Typography.bodyMd,
    color: Colors.outline,
    textAlign: "center",
    maxWidth: 260,
  },
  errorText: { ...Typography.bodyMd, color: Colors.error, marginBottom: Spacing.md, textAlign: "center" },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.full,
  },
  retryText: { ...Typography.titleSm, color: Colors.white },
});
