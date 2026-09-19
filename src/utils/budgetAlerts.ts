import { Budget } from "@/types/domain"
import { formatCurrency } from "@/utils/currency"
import { toDecimal } from "@/utils/money"
import { sendBudgetAlert } from "@/utils/notifications"

const THRESHOLDS = [100, 80] // checked highest-first so a jump straight past 100% doesn't also fire the 80% alert

/**
 * Compares budgets before/after some action (a new transaction, a Gmail
 * sync) and fires a local notification for each budget that just crossed
 * 80% or 100% of its limit for the first time.
 */
export async function notifyBudgetThresholdCrossings(before: Budget[], after: Budget[]): Promise<void> {
  for (const afterBudget of after) {
    const limit = toDecimal(afterBudget.limit_amount)
    if (limit.lte(0)) continue

    const beforeBudget = before.find(b => b.id === afterBudget.id)
    const beforePercent = beforeBudget ? toDecimal(beforeBudget.spent_amount).div(toDecimal(beforeBudget.limit_amount)).times(100) : toDecimal(0)
    const afterPercent = toDecimal(afterBudget.spent_amount).div(limit).times(100)

    for (const threshold of THRESHOLDS) {
      if (beforePercent.lt(threshold) && afterPercent.gte(threshold)) {
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
