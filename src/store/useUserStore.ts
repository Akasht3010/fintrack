import { create } from "zustand"
import { storage as SecureStore } from "@/utils/storage"
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
    await SecureStore.deleteItemAsync("access_token")
    await SecureStore.deleteItemAsync("refresh_token")
    await SecureStore.deleteItemAsync("user")
    set({ user: null, isAuthenticated: false, isLoading: false })
  }
}))
