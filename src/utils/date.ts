import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import localizedFormat from "dayjs/plugin/localizedFormat"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

// The backend stores and returns every timestamp as naive IST wall-clock
// digits with no offset suffix (e.g. "2026-08-02T14:48:09") — deliberately,
// so the raw DB rows themselves read as real IST, not UTC. Every
// transaction here is India-specific, so `dayjs.tz(date, IST_TIMEZONE)`
// parses those digits as IST directly, and "now" is likewise converted to
// IST before comparing — both needed so isToday/isThisMonth still land on
// the right calendar day even when the viewing device's own clock is set
// to some other timezone.
export const IST_TIMEZONE = "Asia/Kolkata"

const toIST = (date: string) => dayjs.tz(date, IST_TIMEZONE)
const nowIST = () => dayjs().tz(IST_TIMEZONE)

export const formatDate = (date: string): string =>
  toIST(date).format("DD/MM/YYYY")

export const formatDateShort = (date: string): string =>
  toIST(date).format("DD/MM")

export const formatDateTime = (date: string): string =>
  toIST(date).format("DD/MM/YYYY HH:mm")

export const formatRelative = (date: string): string =>
  toIST(date).fromNow()

export const getCurrentMonth = (): string =>
  nowIST().format("MMMM YYYY")

export const isToday = (date: string): boolean =>
  toIST(date).isSame(nowIST(), "day")

export const isThisMonth = (date: string): boolean =>
  toIST(date).isSame(nowIST(), "month")
