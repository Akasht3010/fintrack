import { apiClient } from "@/api/client"
import { Category } from "@/types/domain"

export const categoriesApi = {
  async list(): Promise<Category[]> {
    const response = await apiClient.get<Category[]>("/api/categories")
    return response.data
  },
  async create(data: { name: string; icon: string }): Promise<Category> {
    const response = await apiClient.post<Category>("/api/categories", data)
    return response.data
  },
  async update(id: string, data: { name?: string; icon?: string }): Promise<Category> {
    const response = await apiClient.patch<Category>(`/api/categories/${id}`, data)
    return response.data
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/categories/${id}`)
  }
}
