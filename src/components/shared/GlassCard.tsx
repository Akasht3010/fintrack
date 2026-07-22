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
  const Wrapper = onPress || onLongPress ? TouchableOpacity : View

  if (!isDark) {
    return (
      <Wrapper
        onPress={onPress}
        onLongPress={onLongPress}
        className={`bg-white border border-border rounded-2xl ${className}`}
      >
        {children}
      </Wrapper>
    )
  }

  return (
    <Wrapper onPress={onPress} onLongPress={onLongPress}>
      <BlurView
        intensity={40}
        tint="dark"
        style={[styles.blur, { borderRadius: radius }]}
      >
        <View className={className} style={styles.tint}>
          {children}
        </View>
      </BlurView>
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  blur: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)"
  },
  tint: {
    backgroundColor: "rgba(99,102,241,0.10)"
  }
})
