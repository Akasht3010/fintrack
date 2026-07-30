import { apiClient } from "@/api/client"
import { Account, AccountType, NetWorthSummary } from "@/types/domain"

export const accountsApi = {
  async list(includeArchived = false): Promise<Account[]> {
    const response = await apiClient.get<Account[]>("/api/accounts", {
      params: { include_archived: includeArchived }
    })
    return response.data
  },
  async netWorth(): Promise<NetWorthSummary> {
    const response = await apiClient.get<NetWorthSummary>("/api/accounts/net-worth")
    return response.data
  },
  async create(data: { name: string; type: AccountType; currency?: string; opening_balance?: number }): Promise<Account> {
    const response = await apiClient.post<Account>("/api/accounts", data)
    return response.data
  },
  async update(id: string, data: { name?: string; opening_balance?: number; is_archived?: boolean }): Promise<Account> {
    const response = await apiClient.patch<Account>(`/api/accounts/${id}`, data)
    return response.data
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/accounts/${id}`)
  }
}
