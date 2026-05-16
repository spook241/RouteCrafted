import { useWindowDimensions } from "react-native";
import { Spacing } from "./theme";

export const TABLET_BREAKPOINT = 768;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  return {
    width,
    height,
    isTablet,
    numColumns: isTablet ? 2 : 1,
    containerPadding: isTablet ? Spacing.xl : Spacing.lg,
    cardGap: isTablet ? 16 : 12,
    avatarSize: isTablet ? 96 : 72,
    headlineSize: isTablet ? 32 : 26,
    sectionFontSize: isTablet ? 20 : 17,
  };
}

/**
 * Calculate item width for FlatList with numColumns.
 * Accounts for container padding and column gap.
 */
export function getItemWidth(
  screenWidth: number,
  numColumns: number,
  containerPadding: number,
  gap: number
): number {
  const totalPadding = containerPadding * 2;
  const totalGaps = gap * (numColumns - 1);
  return (screenWidth - totalPadding - totalGaps) / numColumns;
}
