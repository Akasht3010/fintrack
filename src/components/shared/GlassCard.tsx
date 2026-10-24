import { View, Pressable } from "react-native"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps {
  children: ReactNode
  className?: string
  onPress?: () => void
  onLongPress?: () => void
  radius?: number
}

/**
 * Legacy card surface, now drawn with the design tokens (same look as
 * components/ui/card) so screens that haven't been redesigned yet still
 * match the new ones. New code should use <Card> directly.
 */
export function GlassCard({ children, className = "", onPress, onLongPress, radius = 16 }: GlassCardProps) {
  const isPressable = !!(onPress || onLongPress)
  const base = "border border-border bg-card shadow-sm shadow-black/5"

  if (!isPressable) {
    return (
      <View style={{ borderRadius: radius }} className={cn(base, className)}>
        {children}
      </View>
    )
  }

  // `web:` hover/cursor classes only exist on web; on native, Pressable's
  // active: state gives the touch feedback instead.
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ borderRadius: radius }}
      className={cn(base, "active:opacity-80 web:cursor-pointer web:transition-colors web:duration-150 web:hover:bg-accent/60", className)}
    >
      {children}
    </Pressable>
  )
}
