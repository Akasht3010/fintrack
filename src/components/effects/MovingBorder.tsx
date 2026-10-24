import { useEffect, useState, type ReactNode } from "react"
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "@/lib/theme"

interface MovingBorderProps {
  children: ReactNode
  radius?: number
  borderWidth?: number
  /** Seconds per full revolution of the light. */
  duration?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Aceternity's "Moving Border": a band of light that travels around a
 * card's edge. The card sits inset by `borderWidth` inside a clipped frame;
 * behind it, an oversized square holding a narrow gradient band rotates, so
 * only the sliver of it visible through the frame's edge reads as a border
 * — the rest of the edge shows the plain border color underneath.
 */
export function MovingBorder({ children, radius = 24, borderWidth = 1.5, duration = 7, style }: MovingBorderProps) {
  const { colors } = useTheme()
  const reduceMotion = useReducedMotion()
  const [diagonal, setDiagonal] = useState(0)
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion || diagonal === 0) return
    rotation.value = withRepeat(withTiming(360, { duration: duration * 1000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(rotation)
  }, [diagonal, duration, reduceMotion, rotation])

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    const next = Math.ceil(Math.sqrt(width * width + height * height))
    if (next !== diagonal) setDiagonal(next)
  }

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }))

  return (
    <View
      onLayout={onLayout}
      style={[{ borderRadius: radius, padding: borderWidth, overflow: "hidden", backgroundColor: colors.border }, style]}
    >
      {diagonal > 0 && !reduceMotion && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <Animated.View style={[{ width: diagonal, height: diagonal }, spin]}>
            <LinearGradient
              colors={[colors.glowClear, colors.beam[0], colors.beam[1], colors.beam[2], colors.glowClear]}
              locations={[0.38, 0.45, 0.5, 0.55, 0.62]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}
      <View style={{ borderRadius: radius - borderWidth, overflow: "hidden", backgroundColor: colors.card }}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" }
})
