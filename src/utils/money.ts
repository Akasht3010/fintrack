import { Decimal } from "decimal.js"

// Every amount field from the API (Transaction.amount, Account.balance,
// Budget.limit_amount/spent_amount, NetWorthSummary totals, ...) travels
// as a decimal string, not a JSON number — see fintrack-backend's Money
// serializer. Parse with Decimal for any arithmetic or comparison instead
// of `parseFloat`/`+`/`-`/`/`, so aggregation and threshold checks (e.g.
// "has this budget crossed 90%?") don't inherit IEEE-754 float drift.
export const toDecimal = (value: string | number | Decimal): Decimal => new Decimal(value)

export const sumMoney = (values: (string | number)[]): Decimal =>
  values.reduce((sum: Decimal, v) => sum.plus(v), new Decimal(0))
