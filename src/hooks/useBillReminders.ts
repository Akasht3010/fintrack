import { useEffect } from "react"
import dayjs from "dayjs"
import { recurringApi } from "@/api/endpoints/recurring"
import { formatCurrency } from "@/utils/currency"
import { scheduleBillReminders } from "@/utils/notifications"

const REMINDER_LEAD_DAYS = 1

/**
 * Schedules a local notification a day ahead of each detected recurring
 * bill's next-due estimate. Runs once per app start (bills don't change
 * fast enough to need finer-grained refresh), replacing any previously
 * scheduled reminders so cancelled subscriptions or shifted estimates
 * don't leave stale notifications behind.
 */
export function useBillReminders(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    recurringApi
      .summary()
      .then(({ items }) => {
        const reminders = items.map(item => ({
          identifier: item.merchant.trim().toLowerCase(),
          title: `${item.merchant} charges tomorrow`,
          body: `Estimated ${formatCurrency(item.average_amount)} due ${dayjs(item.next_due_date).format("DD/MM/YYYY")}.`,
          date: dayjs(item.next_due_date).subtract(REMINDER_LEAD_DAYS, "day").toDate()
        }))
        return scheduleBillReminders(reminders)
      })
      .catch(err => console.log("Failed to load recurring bills for reminders:", err))
  }, [enabled])
}
