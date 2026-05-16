import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { router } from "expo-router";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Colors, Radius, Spacing, Shadows, Typography } from "@/lib/theme";
import { useResponsive } from "@/lib/responsive";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { containerPadding } = useResponsive();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { padding: containerPadding }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar & name */}
      <View style={styles.avatarWrapper}>
        <Avatar name={user.name} size="lg" />
        <Text style={styles.name}>{user.name ?? "Traveler"}</Text>
        <Text style={styles.email}>{user.email}</Text>
        {user.role === "admin" && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{user.email}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={styles.infoValue}>{user.role ?? "traveler"}</Text>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { alignItems: "center", gap: Spacing.xl },
  avatarWrapper: { alignItems: "center", gap: Spacing.sm, paddingTop: Spacing.xl },
  name: { ...Typography.displayMd, color: Colors.onSurface },
  email: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  adminBadge: {
    backgroundColor: Colors.secondaryContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  adminBadgeText: { ...Typography.labelMd, color: Colors.secondary },
  infoCard: {
    width: "100%",
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  infoLabel: { ...Typography.titleSm, color: Colors.onSurfaceVariant, width: 48 },
  infoValue: { ...Typography.bodyMd, color: Colors.onSurface, flex: 1 },
  divider: { height: 1, backgroundColor: Colors.outlineVariant, marginHorizontal: -Spacing.xs },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  logoutText: { ...Typography.titleMd, color: Colors.error },
});
