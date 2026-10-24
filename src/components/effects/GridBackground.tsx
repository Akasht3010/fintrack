import { useState } from "react"
import { StyleSheet, View, type LayoutChangeEvent } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useTheme } from "@/lib/theme"

/**
 * Aceternity's "Grid Background": a faint square grid that fades out
 * toward the edges. Aceternity fades it with a CSS radial mask; masks
 * aren't available on native, so two edge-to-center gradients in the
 * background color approximate the same vignette. Lines are plain 1px
 * Views — a few dozen at most, even on a wide desktop window.
 */
export function GridBackground({ cellSize = 44 }: { cellSize?: number }) {
  const { colors } = useTheme()
  const [size, setSize] = useState({ width: 0, height: 0 })

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width !== size.width || height !== size.height) setSize({ width, height })
  }

  const columns = Math.ceil(size.width / cellSize)
  const rows = Math.ceil(size.height / cellSize)

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {Array.from({ length: columns }, (_, i) => (
        <View
          key={`c${i}`}
          style={[styles.vertical, { left: i * cellSize, backgroundColor: colors.gridLine }]}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={`r${i}`}
          style={[styles.horizontal, { top: i * cellSize, backgroundColor: colors.gridLine }]}
        />
      ))}
      <LinearGradient
        colors={[colors.background, colors.backgroundClear, colors.backgroundClear, colors.background]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[colors.background, colors.backgroundClear, colors.backgroundClear, colors.background]}
        locations={[0, 0.2, 0.8, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  vertical: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  horizontal: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth }
})
