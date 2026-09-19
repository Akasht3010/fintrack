import { apiClient } from "@/api/client"
import { RecurringSummary } from "@/types/domain"

export const recurringApi = {
  async summary(signal?: AbortSignal): Promise<RecurringSummary> {
    const response = await apiClient.get<RecurringSummary>("/api/recurring", { signal })
    return response.data
  }
}
