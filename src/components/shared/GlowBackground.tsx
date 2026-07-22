import { View, StyleSheet, Dimensions } from "react-native"
import { BlurView } from "expo-blur"
import { useColorScheme } from "nativewind"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

/**
 * The ambient glow behind the "liquid glass" dark theme — a few large,
 * softly-colored blobs, blurred by a BlurView layered on top of them
 * (BlurView blurs whatever's behind it, so stacking it over plain colored
 * circles is a cheap, reliable way to get a soft glow without needing a
 * platform-specific blur filter on the shapes themselves).
 * Self-aware of the theme — renders nothing in light mode, so screens can
 * just mount it unconditionally.
 */
export function GlowBackground() {
  const { colorScheme } = useColorScheme()
  if (colorScheme !== "dark") return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.base} />
      <View style={[styles.blob, { top: -SCREEN_WIDTH * 0.25, left: -SCREEN_WIDTH * 0.3, backgroundColor: "#4f46e5" }]} />
      <View style={[styles.blob, { top: SCREEN_WIDTH * 0.5, right: -SCREEN_WIDTH * 0.35, backgroundColor: "#7c3aed" }]} />
      <View style={[styles.blob, { bottom: -SCREEN_WIDTH * 0.3, left: -SCREEN_WIDTH * 0.1, backgroundColor: "#2563eb" }]} />
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  )
}

const BLOB_SIZE = SCREEN_WIDTH * 0.9

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a1f"
  },
  blob: {
    position: "absolute",
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    opacity: 0.45
  }
})
