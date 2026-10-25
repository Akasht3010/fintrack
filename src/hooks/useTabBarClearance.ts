// The bottom tab bar is a normal (non-floating) bar that React Navigation
// lays out below the scene, so scroll content never ends up hidden behind
// it — this is just the breathing room left after the last item.
const BREATHING_ROOM = 24

export function useTabBarClearance(): number {
  return BREATHING_ROOM
}
