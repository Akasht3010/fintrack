import { View } from "react-native"
import { useTheme } from "@/lib/theme"

interface BrandMarkProps {
  size?: number
  radius?: number
}

/**
 * The logo mark — three ascending white bars on a square in the theme's
 * primary (blue).
 * Plain Views rather than an SVG so no react-native-svg dependency.
 */
export function BrandMark({ size = 40, radius }: BrandMarkProps) {
  const { colors } = useTheme()
  const barWidth = Math.max(2, size * 0.12)
  const gap = size * 0.08

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.24,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap
      }}
    >
      {[0.32, 0.5, 0.66].map((h) => (
        <View key={h} style={{ width: barWidth, height: size * h, borderRadius: barWidth / 2, backgroundColor: colors.primaryForeground }} />
      ))}
    </View>
  )
}
