import { useWindowDimensions } from "react-native"

// Matches Tailwind/NativeWind's `md` breakpoint (768px) so JS-driven layout
// decisions (sidebar vs. floating tab bar, which can't be expressed with a
// className alone) stay in sync with the `md:` classes used everywhere else.
const DESKTOP_BREAKPOINT = 768

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions()
  return width >= DESKTOP_BREAKPOINT
}
