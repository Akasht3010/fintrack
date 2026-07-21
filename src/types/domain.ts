export type TransactionType = "debit" | "credit"

export type TransactionCategory =
  | "food"
  | "transport"
  | "shopping"
  | "entertainment"
  | "health"
  | "utilities"
  | "rent"
  | "subscriptions"
  | "transfer"
  | "other"

export interface Transaction {
  id: string
  user_id: string
  amount: number
  currency: string
  type: TransactionType
  category: TransactionCategory
  merchant: string
  description: string
  date: string
  source: "gmail" | "manual" | "sms" | "aa"
  is_recurring: boolean
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: TransactionCategory
  limit_amount: number
  spent_amount: number
  period: "weekly" | "monthly"
  start_date: string
  end_date: string
}

export interface User {
  id: string
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
