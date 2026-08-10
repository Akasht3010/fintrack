import { useEffect, useRef } from "react"
import { AppState, AppStateStatus } from "react-native"
import { useUserStore } from "@/store/useUserStore"
import { useGmailSync } from "@/hooks/useGmailSync"

// No server to schedule this, so it piggybacks on the app actually being
// open: syncs on cold start and whenever the app returns to the foreground,
// throttled so backgrounding/foregrounding repeatedly doesn't hammer Gmail.
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000

export function useGmailAutoSync(isAuthenticated: boolean) {
  const gmailConnected = useUserStore(state => state.user?.gmail_connected ?? false)
  const { sync } = useGmailSync()
  const lastSyncedAt = useRef(0)

  useEffect(() => {
    if (!isAuthenticated || !gmailConnected) return

    const maybeSync = () => {
      const now = Date.now()
      if (now - lastSyncedAt.current < MIN_SYNC_INTERVAL_MS) return
      lastSyncedAt.current = now
      sync({ silent: true })
    }

    maybeSync()

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") maybeSync()
    })

    return () => subscription.remove()
  }, [isAuthenticated, gmailConnected, sync])
}
