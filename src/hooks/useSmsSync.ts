import { useCallback, useState } from "react"
import { Alert, Platform, PermissionsAndroid } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import SmsReader from "../../modules/sms-reader"
import { smsApi } from "@/api/endpoints/sms"
import { budgetApi } from "@/api/endpoints/budgets"
import { notifyBudgetThresholdCrossings } from "@/utils/budgetAlerts"

// Reading the whole inbox and shipping it to the backend would mean every
// personal text leaves the device just to find the handful of bank alerts —
// this mirrors the backend parser's own currency check so only messages
// that could plausibly be a transaction alert get sent at all.
const LOOKS_LIKE_BANK_SMS = /(?:INR|Rs\.?|₹)\s*[:.]?\s*[\d,]+|[\d,]+\s*(?:INR|Rs\.?|₹)/i

const INBOX_READ_LIMIT = 500

export interface SmsSyncOptions {
  // Same purpose as useGmailSync's silent option — used for automatic
  // sync-on-open so it doesn't interrupt the user with alerts/permission
  // prompts; the manual "Sync SMS" button still wants full feedback.
  silent?: boolean
}

export function useSmsSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const queryClient = useQueryClient()

  const sync = useCallback(async ({ silent = false }: SmsSyncOptions = {}) => {
    if (Platform.OS !== "android") {
      if (!silent) {
        Alert.alert("Not available", "SMS import is only available on Android.")
      }
      return
    }

    setIsSyncing(true)
    try {
      let hasPermission = SmsReader.hasReadSmsPermission()
      if (!hasPermission) {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
          title: "Read SMS for transaction import",
          message: "FinTrack reads your SMS inbox to find bank transaction alerts and import them automatically. Nothing else is read or sent anywhere else.",
          buttonPositive: "Allow",
          buttonNegative: "Deny"
        })
        hasPermission = result === PermissionsAndroid.RESULTS.GRANTED
      }

      if (!hasPermission) {
        if (!silent) {
          Alert.alert("Permission needed", "SMS import needs permission to read your messages. You can allow it from your phone's app settings.")
        }
        return
      }

      const messages = await SmsReader.getInboxMessages(INBOX_READ_LIMIT)
      const candidates = messages
        .filter((message) => message.body && LOOKS_LIKE_BANK_SMS.test(message.body))
        .map((message) => ({ address: message.address, body: message.body, date: message.date }))

      if (candidates.length === 0) {
        if (!silent) {
          Alert.alert("Sync complete", "No bank transaction messages found in your SMS inbox.")
        }
        return
      }

      const budgetsBefore = await budgetApi.list().catch(() => [])
      const result = await smsApi.sync(candidates)
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })

      if (result.imported > 0) {
        const budgetsAfter = await budgetApi.list().catch(() => [])
        await notifyBudgetThresholdCrossings(budgetsBefore, budgetsAfter)
      }

      if (!silent) {
        Alert.alert(
          "Sync complete",
          `Imported ${result.imported} new transaction${result.imported === 1 ? "" : "s"}.\n${result.skipped_duplicate} already imported, ${result.skipped_unparsed} couldn't be read.`
        )
      }
    } catch (error: any) {
      if (!silent) {
        Alert.alert("Sync failed", error.response?.data?.detail || error.message || "Something went wrong")
      }
    } finally {
      setIsSyncing(false)
    }
  }, [queryClient])

  return { sync, isSyncing }
}
