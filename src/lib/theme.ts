import { useColorScheme } from "nativewind"
import { DarkTheme, DefaultTheme, type Theme } from "expo-router"

/**
 * JS mirror of the CSS design tokens in src/constants/global.css, for the
 * places a className can't reach: icon colors, LinearGradient stops,
 * ActivityIndicator, React Navigation's tab bar. Keep both files in sync.
 */
export const THEME = {
  light: {
    background: "#ffffff",
    foreground: "#09090b",
    card: "#ffffff",
    primary: "#059669",
    primaryForeground: "#ffffff",
    secondary: "#f4f4f5",
    muted: "#f4f4f5",
    mutedForeground: "#71717a",
    border: "#e4e4e7",
    destructive: "#dc2626",
    positive: "#059669",
    negative: "#dc2626",
    // Effect tints (spotlight, grid, moving border) — tuned per scheme so
    // the same effect reads as a subtle accent in light mode instead of a
    // muddy grey wash.
    glow: "rgba(16,185,129,0.16)",
    // Gradient end stops: the same color at zero alpha. Fading to plain
    // "transparent" (= transparent *black*) makes iOS interpolate through
    // grey, which shows up as a muddy band on light backgrounds.
    glowClear: "rgba(16,185,129,0)",
    backgroundClear: "rgba(255,255,255,0)",
    gridLine: "rgba(9,9,11,0.06)",
    beam: ["#10b981", "#34d399", "#a7f3d0", "#10b981"] as const
  },
  dark: {
    background: "#09090b",
    foreground: "#fafafa",
    card: "#111114",
    primary: "#34d399",
    primaryForeground: "#022c22",
    secondary: "#27272a",
    muted: "#27272a",
    mutedForeground: "#a1a1aa",
    border: "#27272a",
    destructive: "#ef4444",
    positive: "#34d399",
    negative: "#f87171",
    glow: "rgba(52,211,153,0.18)",
    glowClear: "rgba(52,211,153,0)",
    backgroundClear: "rgba(9,9,11,0)",
    gridLine: "rgba(250,250,250,0.06)",
    beam: ["#059669", "#34d399", "#6ee7b7", "#059669"] as const
  }
} as const

export type ThemeColors = (typeof THEME)["light"] | (typeof THEME)["dark"]

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"
  return { colors: isDark ? THEME.dark : THEME.light, isDark }
}

/**
 * React Navigation paints every navigator/scene with its own theme colors
 * (light grey #f2f2f2 by default), underneath anything a screen draws —
 * so without this, transparent screens and `bg-card` containers show that
 * grey instead of our tokens, in dark mode too.
 */
export function navigationTheme(isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme
  const c = isDark ? THEME.dark : THEME.light
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.background,
      card: c.card,
      text: c.foreground,
      border: c.border,
      notification: c.destructive
    }
  }
}
