import { useState } from "react"
import { View, StyleSheet, Dimensions, LayoutChangeEvent } from "react-native"
import { BlurView } from "expo-blur"
import { useColorScheme } from "nativewind"

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
  // Blob geometry scales off this screen's own rendered width, not the
  // window's — on desktop web this View sits inside a capped-width content
  // column (see app/(tabs)/_layout.tsx), not the full browser window, so
  // Dimensions.get("window") would size the blobs for a column several
  // hundred px wider than they actually have to fill.
  const [width, setWidth] = useState(() => Dimensions.get("window").width)
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  if (colorScheme !== "dark") return null

  const blobSize = width * 0.9

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <View style={styles.base} />
      <View style={[blobStyle(blobSize), { top: -width * 0.25, left: -width * 0.3, backgroundColor: "#4f46e5" }]} />
      <View style={[blobStyle(blobSize), { top: width * 0.5, right: -width * 0.35, backgroundColor: "#7c3aed" }]} />
      <View style={[blobStyle(blobSize), { bottom: -width * 0.3, left: -width * 0.1, backgroundColor: "#2563eb" }]} />
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  )
}

function blobStyle(size: number) {
  return {
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: 0.45
  }
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0a1f"
  }
})
