import { View, StyleSheet } from "react-native"
import { useColorScheme } from "nativewind"

/**
 * Dark mode uses a quiet ink surface. Kept as a shared background component
 * so screens can opt into a consistent surface without decorative clutter.
 */
export function GlowBackground() {
  const { colorScheme } = useColorScheme()
  if (colorScheme !== "dark") return null
  return <View style={[StyleSheet.absoluteFill, styles.base]} pointerEvents="none" />
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#0d1511"
  }
})
