import dayjs from "dayjs"

export type DateRange = "all" | "7d" | "30d" | "month"

export const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" }
]

export function dateFromForRange(range: DateRange): string | undefined {
  switch (range) {
    case "7d": return dayjs().subtract(7, "day").startOf("day").toISOString()
    case "30d": return dayjs().subtract(30, "day").startOf("day").toISOString()
    case "month": return dayjs().startOf("month").toISOString()
    default: return undefined
  }
}
