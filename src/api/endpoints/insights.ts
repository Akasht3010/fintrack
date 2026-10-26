import { apiClient } from "@/api/client"
import { InsightsFilters, InsightsSummary } from "@/types/domain"

export const insightsApi = {
  async summary(months = 6, signal?: AbortSignal, filters: InsightsFilters = {}): Promise<InsightsSummary> {
    const response = await apiClient.get<InsightsSummary>("/api/insights", {
      params: { months, account_id: filters.accountId, payment_method: filters.paymentMethod },
      signal
    })
    return response.data
  }
}
