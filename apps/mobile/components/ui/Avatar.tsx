import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Gradients, Radius, Typography } from "@/lib/theme";

type Size = "sm" | "md" | "lg";

interface Props {
  name: string | null;
  size?: Size;
}

const SIZE_MAP: Record<Size, { container: number; font: number }> = {
  sm: { container: 36, font: 14 },
  md: { container: 56, font: 20 },
  lg: { container: 80, font: 28 },
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ name, size = "md" }: Props) {
  const { container, font } = SIZE_MAP[size];
  const initials = getInitials(name);

  return (
    <LinearGradient
      colors={Gradients.horizon}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.circle,
        { width: container, height: container, borderRadius: container / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: font }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    ...Typography.displayMd,
    color: Colors.white,
    includeFontPadding: false,
  },
});
