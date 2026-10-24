import { useEffect, type ReactNode } from "react"
import { type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming
} from "react-native-reanimated"

interface FadeInProps {
  children: ReactNode
  /** ms before this item starts — pass `index * 60` for a stagger. */
  delay?: number
  offset?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Fade + rise on mount, for Aceternity-style staggered reveals. Driven by
 * hand rather than Reanimated's `entering` prop for the same reason as
 * useEntranceAnimation: on web `entering` keeps the element absolutely
 * positioned during the transition, which breaks flex layouts.
 */
export function FadeIn({ children, delay = 0, offset = 10, style }: FadeInProps) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) return
    progress.value = withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }))
  }, [delay, progress, reduceMotion])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }]
  }))

  return <Animated.View style={[animated, style]}>{children}</Animated.View>
}
