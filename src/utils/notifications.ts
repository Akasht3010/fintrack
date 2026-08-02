import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import Constants, { ExecutionEnvironment } from "expo-constants"

// SDK 53 dropped Android push-notification support from Expo Go itself
// (a real dev/production build still works fine) — touching the
// expo-notifications API at all on that combination logs a console.error
// that pops a blocking red LogBox screen on every app launch. Skip
// notification setup entirely there rather than let it clobber the UI.
const notificationsUnsupported =
  Platform.OS === "android" && Constants.executionEnvironment === ExecutionEnvironment.StoreClient

if (!notificationsUnsupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  })
}

let channelReady = false
let billChannelReady = false

async function ensureAndroidChannel() {
  if (Platform.OS !== "android" || channelReady) return
  await Notifications.setNotificationChannelAsync("budget-alerts", {
    name: "Budget alerts",
    importance: Notifications.AndroidImportance.DEFAULT
  })
  channelReady = true
}

async function ensureBillReminderChannel() {
  if (Platform.OS !== "android" || billChannelReady) return
  await Notifications.setNotificationChannelAsync("bill-reminders", {
    name: "Bill reminders",
    importance: Notifications.AndroidImportance.DEFAULT
  })
  billChannelReady = true
}

async function ensurePermission(): Promise<boolean> {
  if (notificationsUnsupported) return false

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

const BILL_REMINDER_PREFIX = "bill-reminder-"

/**
 * Replaces all previously scheduled bill reminders with the given set.
 * Called with the full current list each time (e.g. on app start) rather
 * than incrementally, so merchants that stop recurring or get re-estimated
 * don't leave stale notifications behind.
 */
export async function scheduleBillReminders(
  reminders: { identifier: string; title: string; body: string; date: Date }[]
): Promise<void> {
  try {
    const granted = await ensurePermission()
    if (!granted) return

    await ensureBillReminderChannel()

    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      scheduled
        .filter(n => n.identifier.startsWith(BILL_REMINDER_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    )

    await Promise.all(
      reminders
        .filter(r => r.date.getTime() > Date.now())
        .map(r =>
          Notifications.scheduleNotificationAsync({
            identifier: `${BILL_REMINDER_PREFIX}${r.identifier}`,
            content: { title: r.title, body: r.body },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: r.date,
              channelId: "bill-reminders"
            }
          })
        )
    )
  } catch (err) {
    console.log("Failed to schedule bill reminders:", err)
  }
}
