import { apiClient } from "@/api/client"
import { RecurringSummary } from "@/types/domain"

export const recurringApi = {
  async summary(): Promise<RecurringSummary> {
    const response = await apiClient.get<RecurringSummary>("/api/recurring")
    return response.data
  }
}
