import { useCallback, useState } from "react"
import { Alert } from "react-native"
import { useQueryClient } from "@tanstack/react-query"
import { gmailApi } from "@/api/endpoints/gmail"
import { authApi } from "@/api/endpoints/auth"
import { budgetApi } from "@/api/endpoints/budgets"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { notifyBudgetThresholdCrossings } from "@/utils/budgetAlerts"

export interface GmailSyncOptions {
  // Suppresses the result/error alerts — used for automatic sync-on-open so
  // it doesn't interrupt the user; the manual "Sync" button in Profile still
  // wants the feedback.
  silent?: boolean
}

export function useGmailSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const { setUser } = useUserStore()
  const queryClient = useQueryClient()

  const sync = useCallback(async ({ silent = false }: GmailSyncOptions = {}) => {
    setIsSyncing(true)
    try {
      const budgetsBefore = await budgetApi.list().catch(() => [])
      const result = await gmailApi.sync()
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["budgets"] })

      if (result.imported > 0) {
        const budgetsAfter = await budgetApi.list().catch(() => [])
        await notifyBudgetThresholdCrossings(budgetsBefore, budgetsAfter)
      }

      if (!silent) {
        Alert.alert(
          "Sync complete",
          `Imported ${result.imported} new transaction${result.imported === 1 ? "" : "s"}.\n${result.skipped_duplicate} already imported, ${result.skipped_unparsed} couldn't be read.`
        )
      }
    } catch (error: any) {
      if (!silent) {
        Alert.alert("Sync failed", error.response?.data?.detail || "Something went wrong")
      }
      // A sync failure can mean the backend just cleared a stale/expired
      // Gmail connection (e.g. Google's 7-day testing-token expiry) —
      // refresh the cached user so Profile shows "Connect Gmail" again
      // instead of Sync/Disconnect for a connection that no longer exists.
      try {
        const refreshed = await authApi.getMe()
        await SecureStore.setItemAsync("user", JSON.stringify(refreshed))
        setUser(refreshed)
      } catch {
        // Best-effort — worst case the user reopens the app and it self-corrects
      }
    } finally {
      setIsSyncing(false)
    }
  }, [queryClient, setUser])

  return { sync, isSyncing }
}
