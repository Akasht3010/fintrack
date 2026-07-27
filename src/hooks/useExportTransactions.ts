import { Platform } from "react-native"
import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import { useState } from "react"
import { transactionApi } from "@/api/endpoints/transactions"

export function useExportTransactions() {
  const [isExporting, setIsExporting] = useState(false)

  const exportCsv = async (): Promise<{ success: boolean; error?: string }> => {
    setIsExporting(true)
    try {
      const csv = await transactionApi.exportCsv()
      const filename = `fintrack-transactions-${new Date().toISOString().slice(0, 10)}.csv`

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        return { success: true }
      }

      const file = new File(Paths.document, filename)
      file.create({ overwrite: true })
      file.write(csv)

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export transactions" })
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error?.response?.data?.detail || "Failed to export transactions" }
    } finally {
      setIsExporting(false)
    }
  }

  return { exportCsv, isExporting }
}
