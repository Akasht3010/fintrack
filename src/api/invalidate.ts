import { QueryClient } from "@tanstack/react-query"

// Every query whose result is derived from the user's transactions. Any
// write that adds, edits, deletes, or re-categorizes transactions must
// refresh all of them — invalidating only ["transactions"] left the home
// summary card and Insights (5-minute staleTime) showing old totals, and
// account balances / net worth out of step with the list.
const TRANSACTION_DERIVED_KEYS = [
  "transactions",
  "transaction",
  "budgets",
  "insights",
  "recurring",
  "accounts",
  "net-worth"
] as const

export function invalidateTransactionQueries(queryClient: QueryClient): Promise<void[]> {
  return Promise.all(
    TRANSACTION_DERIVED_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  )
}
