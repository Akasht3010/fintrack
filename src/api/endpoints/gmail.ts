import { apiClient } from "@/api/client"

export interface GmailSyncResult {
  imported: number
  skipped_duplicate: number
  skipped_unparsed: number
}

export const gmailApi = {
  async sync(): Promise<GmailSyncResult> {
    const response = await apiClient.post<GmailSyncResult>("/api/gmail/sync")
    return response.data
  }
}
