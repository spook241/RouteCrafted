import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { apiFetch } from "@/lib/api";
import { Colors, Radius, Spacing, Shadows, Typography } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

interface PlaceCard {
  id: string;
  placeName: string;
  category: string;
  verdict: string;
  worthItReasons: string[];
  skipItReasons: string[];
  bestTimeToVisit: string | null;
  estimatedCost: string | null;
  summary: string | null;
}

// The mobile cards endpoint accepts a tripId, not a cardId directly.
// We fetch all cards for the trip and filter — or we pass the card via router params.
// This screen fetches cards by tripId (passed as id param) and shows a single card
// when reached by placeCardId. We embed the placeCardId in the route and
// fetch via the cards endpoint, then display the matching one.
export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<PlaceCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { containerPadding } = useResponsive();

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<PlaceCard>(`/api/mobile/card/${id}`);
        setCard(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load card");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !card) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Card not found"}</Text>
      </View>
    );
  }

  const isWorthIt = card.verdict === "worth_it";
  const isDepends = card.verdict === "depends";

  const bannerColors = isWorthIt
    ? (["#14532d", "#166534"] as const)
    : isDepends
    ? (["#713f12", "#92400e"] as const)
    : (["#7f1d1d", "#991b1b"] as const);

  const bannerEmoji = isWorthIt ? "⭐" : isDepends ? "🤔" : "⚠️";
  const bannerLabel = isWorthIt ? "Worth It" : isDepends ? "Depends" : "Skip It";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { gap: Spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Verdict banner */}
      <LinearGradient colors={bannerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
        <Text style={styles.bannerEmoji}>{bannerEmoji}</Text>
        <Text style={styles.bannerLabel}>{bannerLabel}</Text>
      </LinearGradient>

      {/* Body */}
      <View style={[styles.bodyPad, { paddingHorizontal: containerPadding }]}>
        {/* Place name + category */}
        <Text style={styles.placeName}>{card.placeName}</Text>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{card.category.replace(/_/g, " ")}</Text>
        </View>

        {/* Summary */}
        {card.summary ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{card.summary}</Text>
          </View>
        ) : null}

        {/* Meta chips */}
        <View style={styles.metaRow}>
          {card.estimatedCost ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>💰 {card.estimatedCost}</Text>
            </View>
          ) : null}
          {card.bestTimeToVisit ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>🕐 {card.bestTimeToVisit}</Text>
            </View>
          ) : null}
        </View>

        {/* Why Visit */}
        {card.worthItReasons.length > 0 ? (
          <View style={[styles.section, styles.sectionWorth]}>
            <Text style={[styles.sectionTitle, styles.sectionTitleWorth]}>Why Visit</Text>
            {card.worthItReasons.map((r, i) => (
              <View key={i} style={styles.reasonRow}>
                <Text style={[styles.bullet, styles.bulletWorth]}>✓</Text>
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Consider Skipping */}
        {card.skipItReasons.length > 0 ? (
          <View style={[styles.section, styles.sectionSkip]}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSkip]}>Consider Skipping If</Text>
            {card.skipItReasons.map((r, i) => (
              <View key={i} style={styles.reasonRow}>
                <Text style={[styles.bullet, styles.bulletSkip]}>✕</Text>
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
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
  content: { paddingBottom: Spacing.xxl },
  banner: {
    paddingVertical: Spacing.xl + 4,
    paddingHorizontal: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  bannerEmoji: { fontSize: 28 },
  bannerLabel: { ...Typography.displayMd, color: Colors.white },
  bodyPad: { gap: Spacing.lg },
  placeName: { ...Typography.displayLg, color: Colors.onSurface },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  categoryText: { ...Typography.labelMd, color: Colors.onSurfaceVariant, textTransform: "capitalize" },
  summaryCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  summaryText: { ...Typography.bodyLg, color: Colors.onSurfaceVariant, lineHeight: 24 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  metaChip: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  metaChipText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  section: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  sectionWorth: { borderLeftWidth: 3, borderLeftColor: "#166534" },
  sectionSkip: { borderLeftWidth: 3, borderLeftColor: "#991b1b" },
  sectionTitle: { ...Typography.titleMd, marginBottom: Spacing.xs },
  sectionTitleWorth: { color: "#166534" },
  sectionTitleSkip: { color: "#991b1b" },
  reasonRow: { flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" },
  bullet: { ...Typography.titleSm, width: 16 },
  bulletWorth: { color: Colors.worthItText },
  bulletSkip: { color: Colors.skipItText },
  reasonText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, flex: 1, lineHeight: 21 },
  errorText: { ...Typography.bodyMd, color: Colors.error, textAlign: "center" },
});
