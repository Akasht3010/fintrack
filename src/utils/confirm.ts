import { Alert, Platform } from "react-native"

interface ConfirmOptions {
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

// React Native Web's Alert.alert only ever renders a single-button
// window.alert() — a second button with its own onPress silently does
// nothing, no dialog, no error. Anything that needs a real yes/no
// confirmation (sign out, delete X) has to go through this instead of
// Alert.alert directly, or it just quietly breaks on web.
export function confirm(title: string, message: string, options: ConfirmOptions = {}): Promise<boolean> {
  const { confirmLabel = "OK", cancelLabel = "Cancel", destructive = false } = options

  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`))
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) }
    ])
  })
}
