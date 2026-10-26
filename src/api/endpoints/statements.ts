import { Platform } from "react-native"
import { apiClient } from "@/api/client"
import { StatementImportResult } from "@/types/domain"

/** A picked file: a browser File on web, a local uri on native. */
export interface StatementFile {
  name: string
  uri: string
  mimeType?: string
  file?: File
}

export const statementsApi = {
  async import(accountId: number, picked: StatementFile): Promise<StatementImportResult> {
    const form = new FormData()
    form.append("account_id", String(accountId))
    if (Platform.OS === "web" && picked.file) {
      form.append("file", picked.file, picked.name)
    } else {
      // React Native's FormData takes a { uri, name, type } descriptor.
      form.append("file", { uri: picked.uri, name: picked.name, type: picked.mimeType || "application/octet-stream" } as any)
    }
    const response = await apiClient.post<StatementImportResult>("/api/statements/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000
    })
    return response.data
  }
}
