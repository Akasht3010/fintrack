import { View, TouchableOpacity, StyleSheet } from "react-native"
import { BlurView } from "expo-blur"
import { useColorScheme } from "nativewind"
import { ReactNode } from "react"

interface GlassCardProps {
  children: ReactNode
  className?: string
  onPress?: () => void
  onLongPress?: () => void
  radius?: number
}

/**
 * A card that's a plain white/dark-neutral surface in light mode (matching
 * the app's existing look), and a real frosted-glass panel in dark mode —
 * a BlurView (blurring the GlowBackground blobs behind it) with a subtle
 * indigo tint and hairline border, matching the "liquid glass" reference.
 */
export function GlassCard({ children, className = "", onPress, onLongPress, radius = 20 }: GlassCardProps) {
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === "dark"
  const isPressable = !!(onPress || onLongPress)
  const Wrapper = isPressable ? TouchableOpacity : View
  // TouchableOpacity's own opacity-on-press feedback is a touch affordance —
  // on desktop web a mouse user gets no signal a card is clickable at all
  // until they've already clicked it. `hover:`/`cursor-pointer` are web-only
  // (NativeWind compiles them to a real `:hover` media query; native ignores
  // them), so this only changes anything on web, and only for cards that are
  // actually pressable.
  const interactiveClasses = isPressable ? "cursor-pointer transition-colors duration-150" : ""

  if (!isDark) {
    return (
      <Wrapper
        onPress={onPress}
        onLongPress={onLongPress}
        className={`bg-white border border-border rounded-2xl ${isPressable ? "hover:bg-neutral-50 hover:border-neutral-300" : ""} ${interactiveClasses} ${className}`}
      >
        {children}
      </Wrapper>
    )
  }

  // Dark mode: the blur + tint are absolutely-positioned BACKGROUND layers
  // with pointerEvents "none", and `children` sit above them inside the
  // touchable itself. The BlurView must never be an ancestor of the press
  // target — on native it swallows the touch before it reaches the wrapping
  // TouchableOpacity, which silently kills every pressable GlassCard.
  return (
    <Wrapper
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ borderRadius: radius, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}
      className={`${isPressable ? "hover:bg-white/[0.06]" : ""} ${interactiveClasses} ${className}`}
    >
      <BlurView intensity={40} tint="dark" pointerEvents="none" style={styles.fill} />
      <View pointerEvents="none" style={[styles.fill, styles.tint]} />
      {children}
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  fill: {
    // RN 0.86 removed StyleSheet.absoluteFillObject; absoluteFill is now the
    // plain object it used to be.
    ...StyleSheet.absoluteFill
  },
  tint: {
    backgroundColor: "rgba(99,102,241,0.10)"
  }
})
