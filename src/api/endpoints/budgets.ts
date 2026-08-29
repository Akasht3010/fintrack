import { apiClient } from "@/api/client"
import { Budget, TransactionCategory } from "@/types/domain"

export interface BudgetCreatePayload {
  category: TransactionCategory
  limit_amount: number
  period: "weekly" | "monthly"
}

export const budgetApi = {
  async list(): Promise<Budget[]> {
    const response = await apiClient.get<Budget[]>("/api/budgets")
    return response.data
  },

  async create(data: BudgetCreatePayload): Promise<Budget> {
    const response = await apiClient.post<Budget>("/api/budgets", data)
    return response.data
  },

  async updateLimit(budgetId: number, limitAmount: number): Promise<Budget> {
    const response = await apiClient.patch<Budget>(`/api/budgets/${budgetId}`, {
      limit_amount: limitAmount
    })
    return response.data
  },

  async delete(budgetId: number) {
    return await apiClient.delete(`/api/budgets/${budgetId}`)
  }
}
