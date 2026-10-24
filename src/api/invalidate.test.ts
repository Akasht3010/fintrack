import { QueryClient } from "@tanstack/react-query"
import { invalidateTransactionQueries } from "./invalidate"

describe("invalidateTransactionQueries", () => {
  it("marks every transaction-derived query stale, and nothing else", async () => {
    const queryClient = new QueryClient()
    const keys = [["transactions", 1, "food"], ["transaction", "7"], ["budgets"], ["insights"],
      ["recurring"], ["accounts", { includeArchived: false }], ["net-worth"], ["categories"]]
    keys.forEach((key) => queryClient.setQueryData(key, {}))

    await invalidateTransactionQueries(queryClient)

    const stale = (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated
    keys.slice(0, -1).forEach((key) => expect(stale(key)).toBe(true))
    expect(stale(["categories"])).toBe(false)
    queryClient.clear()
  })
})
