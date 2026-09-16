import { apiClient } from "@/api/client"

export interface GmailSyncResult {
  imported: number
  skipped_duplicate: number
  skipped_unparsed: number
}

export const gmailApi = {
  // Authenticated call (normal Authorization header) that mints a one-time
  // nonce for the /authorize browser navigation to consume — keeps the real
  // bearer token out of that URL, and therefore out of browser history and
  // access logs. See app/api/gmail.py's gmail_link_token.
  async linkToken(): Promise<{ link_token: string }> {
    const response = await apiClient.get<{ link_token: string }>("/api/gmail/link-token")
    return response.data
  },

  async sync(): Promise<GmailSyncResult> {
    // Fetching/parsing up to 50 emails one by one from Gmail's API can
    // comfortably exceed the default 10s client timeout — give this
    // specific call more room instead of raising the global default.
    const response = await apiClient.post<GmailSyncResult>("/api/gmail/sync", null, {
      timeout: 60000
    })
    return response.data
  },

  async disconnect(): Promise<{ gmail_connected: boolean }> {
    const response = await apiClient.post<{ gmail_connected: boolean }>("/api/gmail/disconnect")
    return response.data
  }
}
