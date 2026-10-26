export type TransactionType = "debit" | "credit"

// Categories are dynamic (defaults + per-user custom ones, see Category below),
// so this is just a string alias for readability at call sites.
export type TransactionCategory = string

export type CategoryType = "expense" | "income" | "both"

export interface Category {
  id: number
  name: string
  icon: string
  type: CategoryType
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: number
  user_id: number
  account_id?: number | null
  // Decimal string, e.g. "19.99" — see src/utils/money.ts.
  amount: string
  currency: string
  type: TransactionType
  category: TransactionCategory
  merchant: string
  description: string
  date: string
  source: "gmail" | "manual" | "sms" | "aa"
  is_recurring: boolean
  created_at: string
  payment_method?: PaymentMethod | null
  // Trailing account/card digits the bank alert quoted (comma-separated) —
  // set on imports, so an unlinked one can say which account it was.
  account_hint?: string | null
}

export type PaymentMethod = "upi" | "card" | "netbanking" | "atm" | "autopay" | "cash" | "other"

export type AccountType = "bank" | "cash" | "credit_card" | "wallet" | "investment"

export interface Account {
  id: number
  name: string
  type: AccountType
  currency: string
  // Decimal strings — see src/utils/money.ts.
  opening_balance: string
  balance: string
  is_archived: boolean
  created_at: string
  institution?: string | null
  // Trailing digits bank alerts print — how imports find this account.
  last4?: string | null
  card_last4?: string | null
  // "alert" = the bank's last "Avl Bal"; "manual" = typed in by the user;
  // null = opening balance + transactions.
  balance_source?: "alert" | "manual" | null
  balance_as_of?: string | null
}

export interface NetWorthAccountItem {
  id: number
  name: string
  type: AccountType
  balance: string
}

export interface NetWorthSummary {
  net_worth: string
  total_assets: string
  total_liabilities: string
  accounts: NetWorthAccountItem[]
}

export interface Budget {
  id: number
  user_id: number
  category: TransactionCategory
  // Decimal strings — see src/utils/money.ts. remaining_amount is
  // server-computed (limit_amount - spent_amount); prefer it over
  // re-deriving the subtraction client-side.
  limit_amount: string
  spent_amount: string
  remaining_amount: string
  period: "weekly" | "monthly"
  start_date: string
  end_date: string
}

export interface User {
  id: number
  name: string
  email: string
  phone?: string
  avatar?: string
  gmail_connected: boolean
  created_at: string
}

export interface MonthlySummary {
  month: string
  totalSpent: number
  totalIncome: number
  topCategory: TransactionCategory
  transactionCount: number
  insight: string
}

export interface MonthlyTotal {
  year: number
  month: number
  label: string
  total: number
}

export interface CategoryBreakdownItem {
  category: TransactionCategory
  total: number
}

export interface MerchantBreakdownItem {
  merchant: string
  total: number
  count: number
}

export interface AccountBreakdownItem {
  account_id: number | null // null = not linked to an account
  name: string
  type: AccountType | null
  total: number
}

export interface PaymentMethodBreakdownItem {
  payment_method: PaymentMethod | null
  total: number
  count: number
}

export interface InsightsSummary {
  monthly_totals: MonthlyTotal[]
  monthly_income_totals: MonthlyTotal[]
  category_breakdown: CategoryBreakdownItem[]
  top_merchants: MerchantBreakdownItem[]
  account_breakdown: AccountBreakdownItem[]
  payment_method_breakdown: PaymentMethodBreakdownItem[]
}

export interface InsightsFilters {
  accountId?: number // 0 = not linked to an account
  paymentMethod?: PaymentMethod
}

export type RecurringCadence = "weekly" | "monthly" | "yearly"

export interface RecurringItem {
  merchant: string
  category: TransactionCategory
  average_amount: number
  currency: string
  cadence: RecurringCadence
  occurrences: number
  last_date: string
  next_due_date: string
}

export interface RecurringSummary {
  items: RecurringItem[]
  monthly_total: number
}
