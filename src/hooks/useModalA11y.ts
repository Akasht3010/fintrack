import { useEffect } from "react"
import { Platform } from "react-native"
import { router } from "expo-router"

// Native-only feature: react-native-web forwards a View's `ref` to the
// underlying DOM node (documented RNW interop behavior), which is what
// makes `.focus()`/`.querySelectorAll()` below work — there's no
// equivalent concept on iOS/Android, where the OS already handles
// screen-reader focus and there's no Escape key to bind.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Web-only modal accessibility: traps Tab/Shift+Tab focus cycling inside
 * the modal, dismisses on Escape, and restores focus to whatever was
 * focused before the modal opened. `containerRef` should be attached to
 * the modal's outermost View.
 */
export function useModalA11y(containerRef: React.RefObject<any>) {
  useEffect(() => {
    if (Platform.OS !== "web") return

    const container = containerRef.current as HTMLElement | null
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    focusables()[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        router.back()
        return
      }
      if (event.key !== "Tab") return

      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [containerRef])
}
