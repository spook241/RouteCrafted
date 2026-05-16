// Design tokens mirroring the web app's Material Design 3 palette
export const Colors = {
  // Primary
  primary: "#0058be",
  primaryContainer: "#2170e4",
  onPrimary: "#ffffff",

  // Secondary
  secondary: "#575a8c",
  secondaryContainer: "#c2c5fe",
  onSecondary: "#ffffff",

  // Surface hierarchy
  surface: "#f9f9ff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f0f3ff",
  surfaceContainer: "#e7eeff",
  surfaceContainerHigh: "#dee8ff",

  // Text
  onSurface: "#111c2d",
  onSurfaceVariant: "#424754",
  outlineVariant: "#c2c6d6",
  outline: "#74788a",

  // Accent
  tertiary: "#ffe24c",

  // Status
  error: "#ba1a1a",
  onError: "#ffffff",

  // Verdict
  worthItBg: "#dcfce7",
  worthItText: "#14532d",
  skipItBg: "#fee2e2",
  skipItText: "#7f1d1d",
  dependsBg: "#fef9c3",
  dependsText: "#713f12",

  // Trip status
  statusDraftBg: "#e7eeff",
  statusDraftText: "#424754",
  statusActiveBg: "#0058be",
  statusActiveText: "#ffffff",
  statusCompletedBg: "#dcfce7",
  statusCompletedText: "#14532d",
  statusPlannedBg: "#ffe24c",
  statusPlannedText: "#111c2d",

  // Utility
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

export const Gradients = {
  horizon: ["#0058be", "#2170e4"] as const,
  horizonLight: ["#e8f0ff", "#f0f3ff"] as const,
};

export const Shadows = {
  card: {
    shadowColor: "#111c2d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHover: {
    shadowColor: "#111c2d",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
};

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Typography = {
  displayLg: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  displayMd: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  headlineSm: { fontSize: 18, fontWeight: "700" as const },
  titleMd: { fontSize: 16, fontWeight: "600" as const },
  titleSm: { fontSize: 14, fontWeight: "600" as const },
  bodyLg: { fontSize: 16, fontWeight: "400" as const },
  bodyMd: { fontSize: 14, fontWeight: "400" as const },
  bodySm: { fontSize: 13, fontWeight: "400" as const },
  labelMd: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.5 },
  labelSm: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.3 },
};
