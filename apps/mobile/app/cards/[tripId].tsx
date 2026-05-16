import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { PlaceCardItem } from "@/components/ui/PlaceCardItem";
import { Colors, Radius, Spacing, Typography } from "@/lib/theme";
import { useResponsive, getItemWidth } from "@/lib/responsive";

interface PlaceCard {
  id: string;
  placeName: string;
  category: string;
  verdict: "worth_it" | "skip_it" | "depends";
  estimatedCost: string | null;
  summary: string | null;
}

type Filter = "all" | "worth_it" | "skip_it";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "worth_it", label: "Worth It ✓" },
  { key: "skip_it", label: "Skip It ✗" },
];

export default function CardsListScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [cards, setCards] = useState<PlaceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const { width, numColumns, containerPadding, cardGap } = useResponsive();

  async function loadCards() {
    try {
      setError(null);
      const data = await apiFetch<PlaceCard[]>(`/api/mobile/cards/${tripId}`);
      setCards(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load place cards");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCards();
  }, [tripId]);

  const filtered =
    filter === "all" ? cards : cards.filter((c) => c.verdict === filter);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={loadCards} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const itemWidth = getItemWidth(width, numColumns, containerPadding, cardGap);

  return (
    <View style={styles.container}>
      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={[
          styles.filterBarContent,
          { paddingHorizontal: containerPadding },
        ]}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.pill, filter === f.key && styles.pillActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[styles.pillText, filter === f.key && styles.pillTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="compass-outline" size={52} color={Colors.outlineVariant} />
          <Text style={styles.emptyTitle}>No cards here</Text>
          <Text style={styles.emptySubtitle}>
            {filter === "all"
              ? "No place cards have been generated for this trip yet."
              : `No "${FILTERS.find((f) => f.key === filter)?.label}" cards for this trip.`}
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            { padding: containerPadding, gap: cardGap },
          ]}
          columnWrapperStyle={numColumns > 1 ? { gap: cardGap } : undefined}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={numColumns}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadCards();
              }}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <View
              style={{
                width: numColumns > 1 ? itemWidth : undefined,
                flex: numColumns === 1 ? 1 : undefined,
              }}
            >
              <PlaceCardItem
                card={item}
                onPress={() =>
                  router.push({ pathname: "/card/[id]", params: { id: item.id } })
                }
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceContainerLow },
  center: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  filterBar: {
    flexGrow: 0,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  filterBarContent: { gap: Spacing.sm, flexDirection: "row" },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: { ...Typography.titleSm, color: Colors.onSurfaceVariant },
  pillTextActive: { color: Colors.white },
  listContent: {},
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: { ...Typography.headlineSm, color: Colors.onSurfaceVariant },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    textAlign: "center",
    maxWidth: 260,
  },
  errorText: {
    ...Typography.bodyMd,
    color: Colors.error,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.full,
  },
  retryText: { ...Typography.titleSm, color: Colors.white },
});
