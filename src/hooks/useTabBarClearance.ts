import { useSafeAreaInsets } from "react-native-safe-area-context"

// Must match the floating tab bar's own geometry in app/(tabs)/_layout.tsx
// (bottom offset + height), plus a little breathing room, so scrollable
// content never ends up hidden behind it.
const TAB_BAR_HEIGHT = 64
const TAB_BAR_BOTTOM_GAP = 16
const BREATHING_ROOM = 24

export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets()
  return insets.bottom + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + BREATHING_ROOM
}
