import dayjs from "dayjs"
import { IST_TIMEZONE } from "./date"

export type DateRange = "all" | "7d" | "30d" | "month"

export const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" }
]

// Boundaries are computed against the IST calendar day/month (same as
// everything is displayed in), not the device's local one — otherwise
// "This month" could disagree with what's actually shown near a month/day
// boundary on a device not set to IST.
export function dateFromForRange(range: DateRange): string | undefined {
  const now = dayjs().tz(IST_TIMEZONE)
  switch (range) {
    case "7d": return now.subtract(7, "day").startOf("day").toISOString()
    case "30d": return now.subtract(30, "day").startOf("day").toISOString()
    case "month": return now.startOf("month").toISOString()
    default: return undefined
  }
}
