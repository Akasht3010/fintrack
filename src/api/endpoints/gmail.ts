import { apiClient } from "@/api/client"

export interface GmailSyncResult {
  imported: number
  skipped_duplicate: number
  skipped_unparsed: number
}

export const gmailApi = {
  async sync(): Promise<GmailSyncResult> {
    // Fetching/parsing up to 50 emails one by one from Gmail's API can
    // comfortably exceed the default 10s client timeout — give this
    // specific call more room instead of raising the global default.
    const response = await apiClient.post<GmailSyncResult>("/api/gmail/sync", null, {
      timeout: 60000
    })
    return response.data
  }
}
