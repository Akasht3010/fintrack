import { Budget } from "@/types/domain"
import { formatCurrency } from "@/utils/currency"
import { sendBudgetAlert } from "@/utils/notifications"

const THRESHOLDS = [100, 80] // checked highest-first so a jump straight past 100% doesn't also fire the 80% alert

/**
 * Compares budgets before/after some action (a new transaction, a Gmail
 * sync) and fires a local notification for each budget that just crossed
 * 80% or 100% of its limit for the first time.
 */
export async function notifyBudgetThresholdCrossings(before: Budget[], after: Budget[]): Promise<void> {
  for (const afterBudget of after) {
    if (afterBudget.limit_amount <= 0) continue

    const beforeBudget = before.find(b => b.id === afterBudget.id)
    const beforePercent = beforeBudget ? (beforeBudget.spent_amount / beforeBudget.limit_amount) * 100 : 0
    const afterPercent = (afterBudget.spent_amount / afterBudget.limit_amount) * 100

    for (const threshold of THRESHOLDS) {
      if (beforePercent < threshold && afterPercent >= threshold) {
        const title = threshold >= 100
          ? `${capitalize(afterBudget.category)} budget exceeded`
          : `${capitalize(afterBudget.category)} budget at ${threshold}%`
        const body = `You've spent ${formatCurrency(afterBudget.spent_amount)} of your ${formatCurrency(afterBudget.limit_amount)} ${afterBudget.period} limit.`

        await sendBudgetAlert(title, body)
        break // don't also fire the lower threshold for the same crossing
      }
    }
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
