import { useColorScheme } from "nativewind"
import { DarkTheme, DefaultTheme, type Theme } from "expo-router"

/**
 * JS mirror of the CSS design tokens in src/constants/global.css, for the
 * places a className can't reach: icon colors, ActivityIndicator, React
 * Navigation's tab bar. Keep both files in sync.
 */
export const THEME = {
  light: {
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#ffffff",
    primary: "#2563eb",
    primaryForeground: "#ffffff",
    secondary: "#f5f5f5",
    muted: "#f5f5f5",
    mutedForeground: "#737373",
    border: "#e5e5e5",
    destructive: "#dc2626",
    positive: "#16a34a",
    negative: "#dc2626"
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#fafafa",
    card: "#0a0a0a",
    primary: "#3b82f6",
    primaryForeground: "#ffffff",
    secondary: "#262626",
    muted: "#262626",
    mutedForeground: "#a3a3a3",
    border: "#262626",
    destructive: "#ef4444",
    positive: "#4ade80",
    negative: "#f87171"
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
