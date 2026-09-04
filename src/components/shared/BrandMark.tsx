import { View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

interface BrandMarkProps {
  size?: number
  radius?: number
}

/**
 * The app's actual logo mark — three ascending bars on a green gradient
 * square, matching the mark used on the marketing site (fintrack-web) and
 * the app favicon. Built from plain Views + LinearGradient (already a
 * dependency) rather than an SVG file, so it scales crisply at any size
 * without adding react-native-svg just for one icon.
 */
export function BrandMark({ size = 40, radius }: BrandMarkProps) {
  const barWidth = Math.max(2, size * 0.12)
  const gap = size * 0.08

  return (
    <LinearGradient
      colors={["#4ade80", "#16a34a"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.28,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap
      }}
    >
      <View style={{ width: barWidth, height: size * 0.32, borderRadius: barWidth / 2, backgroundColor: "#052e14" }} />
      <View style={{ width: barWidth, height: size * 0.5, borderRadius: barWidth / 2, backgroundColor: "#052e14" }} />
      <View style={{ width: barWidth, height: size * 0.66, borderRadius: barWidth / 2, backgroundColor: "#052e14" }} />
    </LinearGradient>
  )
}
