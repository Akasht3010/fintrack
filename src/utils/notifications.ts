import * as Notifications from "expo-notifications"
import { Platform } from "react-native"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
})

let channelReady = false

async function ensureAndroidChannel() {
  if (Platform.OS !== "android" || channelReady) return
  await Notifications.setNotificationChannelAsync("budget-alerts", {
    name: "Budget alerts",
    importance: Notifications.AndroidImportance.DEFAULT
  })
  channelReady = true
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true

  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

export async function sendBudgetAlert(title: string, body: string): Promise<void> {
  try {
    const granted = await ensurePermission()
    if (!granted) return

    await ensureAndroidChannel()

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null // fire immediately
    })
  } catch (err) {
    // Notifications are a nice-to-have here — never let a failure to notify
    // block the actual action (adding an expense, syncing Gmail) that
    // triggered it.
    console.log("Failed to send budget alert:", err)
  }
}
