import { apiClient } from "@/api/client"
import { PaymentMethod, Transaction } from "@/types/domain"

export interface TransactionCreatePayload {
  amount: number
  type: "debit" | "credit"
  category: string
  merchant: string
  description: string
  date: string
  source: "gmail" | "manual" | "sms" | "aa"
  is_recurring?: boolean
  account_id?: number | null
  payment_method?: PaymentMethod | null
  // Lets a retried create (e.g. resent after a timeout, the first attempt
  // having actually succeeded) 409 instead of silently double-inserting —
  // see the backend's (user_id, idempotency_key) unique index.
  idempotency_key?: string
}

export interface TransactionUpdatePayload {
  amount?: number
  type?: "debit" | "credit"
  category?: string
  merchant?: string
  description?: string
  account_id?: number | null
  payment_method?: PaymentMethod | null
}

export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  limit: number
}

export interface TransactionListFilters {
  page?: number
  limit?: number
  category?: string
  q?: string
  date_from?: string
  date_to?: string
  min_amount?: number
  max_amount?: number
  account_id?: number // 0 = not linked to an account
  payment_method?: PaymentMethod
}

export interface TransactionExportFilters {
  category?: string
  date_from?: string
  date_to?: string
  min_amount?: number
  max_amount?: number
  source?: string
  type?: string
}

export const transactionApi = {
  async create(data: TransactionCreatePayload): Promise<Transaction> {
    const response = await apiClient.post<Transaction>(
      "/api/transactions",
      data
    )
    return response.data
  },

  async update(transactionId: number, data: TransactionUpdatePayload): Promise<Transaction> {
    const response = await apiClient.patch<Transaction>(
      `/api/transactions/${transactionId}`,
      data
    )
    return response.data
  },

  async list(filters: TransactionListFilters = {}, signal?: AbortSignal) {
    const { page = 1, limit = 20, ...rest } = filters
    const response = await apiClient.get<TransactionListResponse>(
      "/api/transactions",
      { params: { page, limit, ...rest }, signal }
    )
    return response.data
  },

  async getById(transactionId: number, signal?: AbortSignal): Promise<Transaction> {
    const response = await apiClient.get<Transaction>(
      `/api/transactions/${transactionId}`,
      { signal }
    )
    return response.data
  },

  async delete(transactionId: number) {
    return await apiClient.delete(`/api/transactions/${transactionId}`)
  },

  async exportCsv(filters: TransactionExportFilters = {}): Promise<string> {
    const response = await apiClient.get<string>("/api/transactions/export", {
      params: filters,
      responseType: "text",
      transformResponse: (data) => data
    })
    return response.data
  }
}
