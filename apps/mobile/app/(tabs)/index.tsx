import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";

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
        <ActivityIndicator size="large" color="#3b82f6" />
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
        <Ionicons name="map-outline" size={48} color="#334155" />
        <Text style={styles.emptyTitle}>No trips yet</Text>
        <Text style={styles.emptySubtitle}>
          Create a trip on the RouteCrafted website to get started.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={trips}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3b82f6"
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push({ pathname: "/trip/[id]", params: { id: item.id } })}
          activeOpacity={0.75}
        >
          <View style={styles.cardTop}>
            <Text style={styles.destination}>{item.destination}</Text>
            <View style={[styles.badge, item.status === "completed" ? styles.badgeDone : styles.badgeActive]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.dates}>
            {new Date(item.startDate).toLocaleDateString()} –{" "}
            {new Date(item.endDate).toLocaleDateString()}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#475569"
            style={styles.chevron}
          />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  list: { backgroundColor: "#0f172a" },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  destination: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeActive: { backgroundColor: "#1d4ed8" },
  badgeDone: { backgroundColor: "#14532d" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "500" },
  dates: { color: "#94a3b8", fontSize: 13 },
  chevron: { position: "absolute", right: 16, top: 16 },
  errorText: { color: "#f87171", marginBottom: 12, textAlign: "center" },
  retryBtn: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  emptyTitle: { color: "#94a3b8", fontSize: 18, fontWeight: "600", marginTop: 16 },
  emptySubtitle: { color: "#64748b", fontSize: 14, textAlign: "center", marginTop: 8 },
});
