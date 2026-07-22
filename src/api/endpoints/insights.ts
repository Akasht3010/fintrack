import { apiClient } from "@/api/client"
import { InsightsSummary } from "@/types/domain"

export const insightsApi = {
  async summary(months = 6): Promise<InsightsSummary> {
    const response = await apiClient.get<InsightsSummary>("/api/insights", { params: { months } })
    return response.data
  }
}
