import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import localizedFormat from "dayjs/plugin/localizedFormat"

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

export const formatDate = (date: string): string =>
  dayjs(date).format("DD MMM YYYY")

export const formatDateShort = (date: string): string =>
  dayjs(date).format("DD MMM")

export const formatRelative = (date: string): string =>
  dayjs(date).fromNow()

export const getCurrentMonth = (): string =>
  dayjs().format("MMMM YYYY")

export const isToday = (date: string): boolean =>
  dayjs(date).isSame(dayjs(), "day")

export const isThisMonth = (date: string): boolean =>
  dayjs(date).isSame(dayjs(), "month")
