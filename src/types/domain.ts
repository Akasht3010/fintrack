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
  amount: number
  currency: string
  type: TransactionType
  category: TransactionCategory
  merchant: string
  description: string
  date: string
  source: "gmail" | "manual" | "sms" | "aa"
  rawText?: string
  isRecurring: boolean
  metadata?: Record<string, string>
}

export interface Budget {
  id: string
  category: TransactionCategory
  limitAmount: number
  spentAmount: number
  period: "weekly" | "monthly"
  startDate: string
  endDate: string
}

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  avatar?: string
  gmailConnected: boolean
  createdAt: string
}

export interface MonthlySummary {
  month: string
  totalSpent: number
  totalIncome: number
  topCategory: TransactionCategory
  transactionCount: number
  insight: string
}
