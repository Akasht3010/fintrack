import { useState } from "react"
import { Transaction } from "@/types/domain"
import dayjs from "dayjs"

type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc"

export function useTransactionFilters(transactions: Transaction[]) {
  const [sortBy, setSortBy] = useState<SortOption>("date-desc")
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: dayjs().subtract(1, "month").format("YYYY-MM-DD"),
    end: dayjs().format("YYYY-MM-DD")
  })

  const filtered = transactions.filter(t => {
    const txDate = dayjs(t.date).format("YYYY-MM-DD")
    return txDate >= dateRange.start && txDate <= dateRange.end
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      case "date-asc":
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      case "amount-desc":
        return b.amount - a.amount
      case "amount-asc":
        return a.amount - b.amount
      default:
        return 0
    }
  })

  return {
    sorted,
    sortBy,
    setSortBy,
    dateRange,
    setDateRange
  }
}
