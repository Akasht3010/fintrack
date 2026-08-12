import { apiClient } from "@/api/client"

export interface SmsSyncResult {
  imported: number
  skipped_duplicate: number
  skipped_unparsed: number
}

export interface SmsMessagePayload {
  address: string | null
  body: string | null
  date: number
}

export const smsApi = {
  async sync(messages: SmsMessagePayload[]): Promise<SmsSyncResult> {
    // Parsing a large inbox batch server-side can take a while — same
    // reasoning as the Gmail sync timeout override.
    const response = await apiClient.post<SmsSyncResult>(
      "/api/sms/sync",
      { messages },
      { timeout: 60000 }
    )
    return response.data
  }
}
