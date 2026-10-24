import { useCallback, useState } from "react"
import { Platform, PermissionsAndroid } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import SmsReader from "../../modules/sms-reader"
import { smsApi } from "@/api/endpoints/sms"
import { budgetApi } from "@/api/endpoints/budgets"
import { notifyBudgetThresholdCrossings } from "@/utils/budgetAlerts"
import { extractErrorMessage } from "@/api/client"
import { showAlert } from "@/utils/alert"
import { invalidateTransactionQueries } from "@/api/invalidate"

// Reading the whole inbox and shipping it to the backend would mean every
// personal text leaves the device just to find the handful of bank alerts —
// this mirrors the backend parser's own currency check so only messages
// that could plausibly be a transaction alert get sent at all.
const LOOKS_LIKE_BANK_SMS = /(?:INR|Rs\.?|₹)\s*[:.]?\s*[\d,]+|[\d,]+\s*(?:INR|Rs\.?|₹)/i

// The currency check alone is too broad — a friend's "Rs 500 for dinner"
// text matches it too. Real bank/merchant SMS in India comes from a
// DLT-registered alphanumeric sender id (e.g. "HDFCBK", "VM-ICICIB") or a
// short numeric code, never from an ordinary phone number — requiring the
// sender to look like one of those keeps personal messages from a phone
// number out even when they happen to mention a rupee amount.
const LOOKS_LIKE_BANK_SENDER = /^(?:[A-Z]{2}-)?[A-Z0-9]{6}$|^\d{5,6}$/

// Bank senders also carry OTPs ("HDFCBK: 123456 is your OTP") — strip the
// code itself before the message body ever leaves the device, independent
// of whether the message is otherwise a real transaction alert.
const OTP_DIGITS_BEFORE_KEYWORD = /\b\d{4,8}\b(?=[^\d]{0,20}\botp\b)/gi
const OTP_DIGITS_AFTER_KEYWORD = /\botp\b[^\d]{0,20}\b(\d{4,8})\b/gi

export function redactOtp(body: string): string {
  return body
    .replace(OTP_DIGITS_BEFORE_KEYWORD, "[REDACTED]")
    .replace(OTP_DIGITS_AFTER_KEYWORD, (match, digits: string) => match.replace(digits, "[REDACTED]"))
}

export function isLikelyBankSms(address: string | null | undefined, body: string | null | undefined): boolean {
  return Boolean(
    body &&
    LOOKS_LIKE_BANK_SMS.test(body) &&
    LOOKS_LIKE_BANK_SENDER.test((address || "").trim().toUpperCase())
  )
}

// Both mirror the backend's SmsSyncRequest bounds — a body over the limit
// would get the whole sync rejected, so it's trimmed here instead. Bank
// alerts put the amount and merchant in the first sentence or two.
const INBOX_READ_LIMIT = 500
const MAX_SMS_BODY_LENGTH = 2000

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
        showAlert("Not available", "SMS import is only available on Android.")
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
          showAlert("Permission needed", "SMS import needs permission to read your messages. You can allow it from your phone's app settings.")
        }
        return
      }

      const messages = await SmsReader.getInboxMessages(INBOX_READ_LIMIT)
      const candidates = messages
        .filter((message) => isLikelyBankSms(message.address, message.body))
        .map((message) => ({ address: message.address, body: redactOtp(message.body!).slice(0, MAX_SMS_BODY_LENGTH), date: message.date }))

      if (candidates.length === 0) {
        if (!silent) {
          showAlert("Sync complete", "No bank transaction messages found in your SMS inbox.")
        }
        return
      }

      const budgetsBefore = await budgetApi.list().catch(() => [])
      const result = await smsApi.sync(candidates)
      invalidateTransactionQueries(queryClient)

      if (result.imported > 0) {
        const budgetsAfter = await budgetApi.list().catch(() => [])
        await notifyBudgetThresholdCrossings(budgetsBefore, budgetsAfter)
      }

      if (!silent) {
        showAlert(
          "Sync complete",
          `Imported ${result.imported} new transaction${result.imported === 1 ? "" : "s"}.\n${result.skipped_duplicate} already imported, ${result.skipped_unparsed} couldn't be read.`
        )
      }
    } catch (error: any) {
      if (!silent) {
        showAlert("Sync failed", extractErrorMessage(error))
      }
    } finally {
      setIsSyncing(false)
    }
  }, [queryClient])

  return { sync, isSyncing }
}
