import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { TripCard } from "@/components/ui/TripCard";
import { Colors, Spacing, Typography, Radius } from "@/lib/theme";
import { useResponsive, getItemWidth } from "@/lib/responsive";

interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

export default function TripsScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width, numColumns, containerPadding, cardGap } = useResponsive();

  async function loadTrips() {
    try {
      setError(null);
      const data = await apiFetch<Trip[]>("/api/mobile/trips");
      setTrips(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trips");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    loadTrips();
  }

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
        <TouchableOpacity onPress={loadTrips} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (trips.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="map-outline" size={56} color={Colors.outlineVariant} />
        <Text style={styles.emptyTitle}>No trips yet</Text>
        <Text style={styles.emptySubtitle}>
          Create a trip on the RouteCrafted website to get started.
        </Text>
      </View>
    );
  }

  const itemWidth = getItemWidth(width, numColumns, containerPadding, cardGap);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        { padding: containerPadding, gap: cardGap },
      ]}
      columnWrapperStyle={numColumns > 1 ? { gap: cardGap } : undefined}
      data={trips}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      key={numColumns} // re-mount FlatList when columns change
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
        />
      }
      renderItem={({ item }) => (
        <View style={{ width: numColumns > 1 ? itemWidth : undefined, flex: numColumns === 1 ? 1 : undefined }}>
          <TripCard
            trip={item}
            onPress={() =>
              router.push({ pathname: "/trip/[id]", params: { id: item.id } })
            }
          />
        </View>
      )}
    />
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
  list: { backgroundColor: Colors.surfaceContainerLow },
  listContent: {},
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
  emptyTitle: {
    ...Typography.headlineSm,
    color: Colors.onSurfaceVariant,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.bodyMd,
    color: Colors.outline,
    textAlign: "center",
    marginTop: Spacing.sm,
    maxWidth: 260,
  },
});
