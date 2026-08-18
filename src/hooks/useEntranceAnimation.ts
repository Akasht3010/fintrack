import { useEffect } from "react"
import { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated"

// A plain opacity+scale mount-in animation, deliberately NOT using
// Reanimated's entering="..." prop — on web that keeps the animated element
// `position: absolute` for the duration of (and, empirically, sometimes
// after) the transition, which fights any parent relying on normal flex
// centering. Driving opacity/transform by hand keeps the element in normal
// flow the entire time, so it can't destabilize a centered layout.
export function useEntranceAnimation(durationMs: number, fromScale = 1) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) })
  }, [])

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: fromScale + (1 - fromScale) * progress.value }]
  }))
}
