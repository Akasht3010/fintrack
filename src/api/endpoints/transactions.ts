import { apiClient } from "@/api/client"
import { Transaction } from "@/types/domain"

export interface TransactionCreatePayload {
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

export interface TransactionUpdatePayload {
  amount?: number
  category?: string
  merchant?: string
  description?: string
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

  async update(transactionId: string, data: TransactionUpdatePayload): Promise<Transaction> {
    const response = await apiClient.patch<Transaction>(
      `/api/transactions/${transactionId}`,
      data
    )
    return response.data
  },

  async list(page: number = 1, limit: number = 20) {
    const response = await apiClient.get<TransactionListResponse>(
      `/api/transactions?page=${page}&limit=${limit}`
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
