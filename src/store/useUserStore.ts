import { create } from "zustand"
import { storage as SecureStore } from "@/utils/storage"
import { clearStoredSession, usesCookieSession } from "@/utils/session"
import { authApi } from "@/api/endpoints/auth"
import { User } from "@/types/domain"

interface UserState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
  logout: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    try {
      // Best-effort: bumps token_version server-side so this token (and any
      // other outstanding one) stops working immediately instead of staying
      // valid until its natural expiry. Never block clearing local state on
      // this — an already-expired/invalid token, a deleted account, or no
      // network at all are all reasons this can fail harmlessly.
      await authApi.logout()
    } catch {
      // Local logout must still succeed either way. On web, a dead cookie
      // makes /logout 401 and can't clear itself — drop it explicitly.
      if (usesCookieSession) {
        await authApi.clearSession().catch(() => {})
      }
    }
    await clearStoredSession()
    await SecureStore.deleteItemAsync("user")
    set({ user: null, isAuthenticated: false, isLoading: false })
  }
}))
