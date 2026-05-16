import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Gradients, Radius, Spacing, Typography } from "@/lib/theme";

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  variant?: "primary" | "outline" | "ghost";
}

export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  style,
  variant = "primary",
}: Props) {
  const isDisabled = disabled || loading;

  if (variant === "outline") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.outlineBtn, isDisabled && styles.disabled, style]}
        activeOpacity={0.75}
      >
        {icon && <View style={styles.iconWrap}>{icon}</View>}
        <Text style={styles.outlineLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === "ghost") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.ghostBtn, isDisabled && styles.disabled, style]}
        activeOpacity={0.75}
      >
        <Text style={styles.ghostLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[styles.wrapper, isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={Gradients.horizon}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <>
            {icon && <View style={styles.iconWrap}>{icon}</View>}
            <Text style={styles.label}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    minHeight: 52,
  },
  label: {
    ...Typography.titleMd,
    color: Colors.white,
    fontSize: 16,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtn: {
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    minHeight: 52,
  },
  outlineLabel: {
    ...Typography.titleMd,
    color: Colors.primary,
    fontSize: 16,
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  ghostLabel: {
    ...Typography.titleSm,
    color: Colors.primary,
  },
  disabled: {
    opacity: 0.55,
  },
});
