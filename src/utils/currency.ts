import { Decimal } from "decimal.js"
import { toDecimal } from "./money"

// The app is INR-only. Accepts the decimal-string amounts the API sends
// (see money.ts), a Decimal from a locally computed sum, or a plain number
// (display-only aggregates the API already returns as float, e.g. insights
// totals) — converted to a number only here, at the final display step,
// where Intl's own rounding to 2 decimal places makes the float conversion
// harmless.
export const formatCurrency = (amount: string | number | Decimal): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(toDecimal(amount).toNumber())
