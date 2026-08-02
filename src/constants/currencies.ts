export interface CurrencyOption {
  code: string
  symbol: string
  label: string
}

// Small, deliberately short list of currencies people actually hold
// accounts/cards in alongside INR — not attempting full ISO 4217 coverage.
export const CURRENCIES: CurrencyOption[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "AED", symbol: "AED", label: "UAE Dirham" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" }
]

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map(c => [c.code, c.symbol])
)

export const currencySymbol = (code: string): string => CURRENCY_SYMBOLS[code] ?? code
