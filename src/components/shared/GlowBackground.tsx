import { View } from "react-native"

/**
 * Full-bleed page background in the theme's `background` token. Kept as a
 * component (rather than inlined) because many screens render it as their
 * first child and pair it with a transparent SafeAreaView.
 */
export function GlowBackground() {
  return <View pointerEvents="none" className="absolute inset-0 bg-background" />
}
