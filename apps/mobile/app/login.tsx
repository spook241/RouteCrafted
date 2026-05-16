import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/lib/auth";
import { GradientButton } from "@/components/ui/GradientButton";
import { Colors, Gradients, Radius, Spacing, Shadows, Typography } from "@/lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Login failed. Check your credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo mark */}
        <View style={styles.logoArea}>
          <LinearGradient
            colors={Gradients.horizon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoEmoji}>✈️</Text>
          </LinearGradient>
          <Text style={styles.appName}>RouteCrafted</Text>
          <Text style={styles.tagline}>AI-powered travel itineraries</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={Colors.outline}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={Colors.outline}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <GradientButton
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.signInBtn}
          />
        </View>

        <Text style={styles.hint}>
          New to RouteCrafted?{" "}
          <Text style={styles.hintLink}>Sign up on routecrafted.app</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  logoArea: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  logoEmoji: {
    fontSize: 32,
  },
  appName: {
    ...Typography.displayLg,
    color: Colors.onSurface,
  },
  tagline: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xxl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.displayMd,
    color: Colors.onSurface,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.titleSm,
    color: Colors.onSurface,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.bodyLg,
    color: Colors.onSurface,
  },
  errorCard: {
    backgroundColor: "#fee2e2",
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.bodyMd,
    color: Colors.error,
  },
  signInBtn: {
    marginTop: Spacing.xs,
  },
  hint: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
    textAlign: "center",
  },
  hintLink: {
    color: Colors.primary,
    fontWeight: "600",
  },
});
