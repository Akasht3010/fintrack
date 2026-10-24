import { useEffect } from "react"
import { Platform, StyleSheet, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "@/lib/theme"

// Wide soft wash → narrow bright core. Stacking a few ellipses of
// decreasing width approximates a blurred falloff where blur isn't
// available (native); on web the whole beam is also CSS-blurred.
const LAYERS = [
  { width: 560, height: 900, endY: 1 },
  { width: 360, height: 820, endY: 0.9 },
  { width: 200, height: 720, endY: 0.8 }
]

/**
 * Aceternity's "Spotlight": a tilted beam of light that sweeps in from the
 * top-left corner once on mount. Fills (and is clipped to) its parent, with
 * the bottom edge faded into the page background so the beam never ends at
 * a hard line wherever the parent stops.
 */
export function Spotlight({ delay = 150 }: { delay?: number }) {
  const { colors } = useTheme()
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) return
    progress.value = withDelay(delay, withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }))
  }, [delay, progress, reduceMotion])

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: (1 - progress.value) * -120 },
      { translateY: (1 - progress.value) * -90 },
      { rotate: "-32deg" },
      { scale: 0.7 + progress.value * 0.3 }
    ]
  }))

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <Animated.View style={[styles.beam, Platform.OS === "web" && styles.webBlur, style]}>
        {LAYERS.map((layer) => (
          <LinearGradient
            key={layer.width}
            colors={[colors.glow, colors.glowClear]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: layer.endY }}
            style={{ position: "absolute", width: layer.width, height: layer.height, borderRadius: layer.width / 2 }}
          />
        ))}
      </Animated.View>
      <LinearGradient
        colors={[colors.backgroundClear, colors.background]}
        style={styles.bottomFade}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  beam: {
    position: "absolute",
    top: -260,
    left: -180,
    width: 560,
    height: 900,
    alignItems: "center"
  },
  // react-native-web passes `filter` straight through to CSS.
  webBlur: { filter: "blur(36px)" } as object,
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%"
  }
})
