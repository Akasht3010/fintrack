import { View, TouchableOpacity } from "react-native"
import { useColorScheme } from "nativewind"
import { ReactNode } from "react"

interface GlassCardProps {
  children: ReactNode
  className?: string
  onPress?: () => void
  onLongPress?: () => void
  radius?: number
}

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

  return (
    <Wrapper
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ borderRadius: radius }}
      className={`${isDark ? "bg-neutral-900 border border-white/10" : "bg-white border border-border shadow-sm"} ${isPressable ? "hover:bg-neutral-50 dark:hover:bg-white/[0.06]" : ""} ${interactiveClasses} ${className}`}
    >
      {children}
    </Wrapper>
  )
}
