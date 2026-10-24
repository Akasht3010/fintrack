import { Decimal } from "decimal.js"
import { toDecimal } from "./money"

// The app is INR-only. Accepts the decimal-string amounts the API sends
// (see money.ts), a Decimal from a locally computed sum, or a plain number
// (display-only aggregates the API already returns as float, e.g. insights
// totals) — converted to a number only here, at the final display step,
// where Intl's own rounding to 2 decimal places makes the float conversion
// harmless.
export const formatCurrency = (amount: string | number | Decimal): string => {
  // Whole rupees show no decimals; anything with paise shows both digits —
  // "₹712.50", never "₹712.5" (which reads like a typo on a money figure).
  const value = toDecimal(amount).toDecimalPlaces(2)
  const digits = value.isInteger() ? 0 : 2
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value.toNumber())
}
