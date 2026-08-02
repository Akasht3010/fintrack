import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import localizedFormat from "dayjs/plugin/localizedFormat"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

// The backend always stores and returns timestamps as UTC wall-clock
// digits with no offset suffix (e.g. "2026-08-02T14:48:09"). Every
// transaction here is India-specific, so always render in IST regardless
// of the viewing device's own timezone — plain `dayjs(date)` would instead
// treat that naive string as if it were already local time and never
// actually convert it, silently showing the raw UTC clock instead.
export const IST_TIMEZONE = "Asia/Kolkata"

const toIST = (date: string) => dayjs.utc(date).tz(IST_TIMEZONE)

export const formatDate = (date: string): string =>
  toIST(date).format("DD/MM/YYYY")

export const formatDateShort = (date: string): string =>
  toIST(date).format("DD/MM")

export const formatDateTime = (date: string): string =>
  toIST(date).format("DD/MM/YYYY HH:mm")

export const formatRelative = (date: string): string =>
  toIST(date).fromNow()

export const getCurrentMonth = (): string =>
  dayjs().tz(IST_TIMEZONE).format("MMMM YYYY")

export const isToday = (date: string): boolean =>
  toIST(date).isSame(dayjs().tz(IST_TIMEZONE), "day")

export const isThisMonth = (date: string): boolean =>
  toIST(date).isSame(dayjs().tz(IST_TIMEZONE), "month")
