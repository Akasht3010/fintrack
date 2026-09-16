import { Alert, Platform } from "react-native"

// React Native Web's Alert.alert() is a complete no-op on this RN Web
// version (not even a window.alert() fallback, despite what the comment in
// confirm.ts assumed) — every informational/error alert has to go through
// this instead of calling Alert.alert directly, or it silently vanishes on
// web with no dialog, no console warning, nothing. `onDismiss` (for the rare
// alert that navigates after the user taps OK) fires from the native
// button's onPress on mobile, and right after window.alert() returns on web
// — that call already blocks until dismissed, so the ordering is the same.
export function showAlert(title: string, message?: string, onDismiss?: () => void): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title)
    onDismiss?.()
    return
  }

  if (onDismiss) {
    Alert.alert(title, message, [{ text: "OK", onPress: onDismiss }])
  } else {
    Alert.alert(title, message)
  }
}
