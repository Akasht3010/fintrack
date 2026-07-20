import { apiClient } from "@/api/client"
import { Transaction } from "@/types/domain"

export interface TransactionCreatePayload {
  user_id: string
  amount: number
  currency: string
  type: "debit" | "credit"
  category: string
  merchant: string
  description: string
  date: string
  source: "gmail" | "manual" | "sms" | "aa"
  is_recurring?: boolean
  raw_text?: string
}

export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
}

export const transactionApi = {
  async create(data: TransactionCreatePayload): Promise<Transaction> {
    const response = await apiClient.post<Transaction>(
      "/api/transactions",
      data
    )
    return response.data
  },

  async list(userId: string, page: number = 1, limit: number = 20) {
    const response = await apiClient.get<TransactionListResponse>(
      `/api/transactions?user_id=${userId}&page=${page}&limit=${limit}`
    )
    return response.data
  },

  async getById(transactionId: string): Promise<Transaction> {
    const response = await apiClient.get<Transaction>(
      `/api/transactions/${transactionId}`
    )
    return response.data
  },

  async delete(transactionId: string) {
    return await apiClient.delete(`/api/transactions/${transactionId}`)
  }
}
