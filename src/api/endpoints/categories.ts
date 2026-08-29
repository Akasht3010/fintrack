import { apiClient } from "@/api/client"
import { Category, CategoryType } from "@/types/domain"

export const categoriesApi = {
  /** Omit `type` for every category; pass "expense"/"income" to also include "both" (transfer, other) but exclude the other type's. */
  async list(type?: CategoryType): Promise<Category[]> {
    const response = await apiClient.get<Category[]>("/api/categories", { params: type ? { type } : undefined })
    return response.data
  },
  async create(data: { name: string; icon: string; type?: CategoryType }): Promise<Category> {
    const response = await apiClient.post<Category>("/api/categories", data)
    return response.data
  },
  async update(id: number, data: { name?: string; icon?: string; type?: CategoryType }): Promise<Category> {
    const response = await apiClient.patch<Category>(`/api/categories/${id}`, data)
    return response.data
  },
  async remove(id: number): Promise<void> {
    await apiClient.delete(`/api/categories/${id}`)
  }
}
