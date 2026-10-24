import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"

/** A slow, low-contrast spotlight inspired by Aceternity's ambient effects. */
export function AmbientSpotlight() {
  const drift = useSharedValue(0)

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    )
  }, [drift])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.34 + drift.value * 0.12,
    transform: [
      { translateX: drift.value * 22 },
      { translateY: drift.value * -14 },
      { scale: 0.96 + drift.value * 0.08 }
    ]
  }))

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.orb, animatedStyle]}>
        <LinearGradient
          colors={["rgba(16,185,129,0.20)", "rgba(16,185,129,0.04)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    width: 520,
    height: 520,
    left: "8%",
    top: "4%",
    borderRadius: 260,
    overflow: "hidden"
  }
})
