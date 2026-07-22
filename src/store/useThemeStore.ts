import { create } from "zustand"
import { storage as SecureStore } from "@/utils/storage"
import { colorScheme } from "nativewind"

export type ThemeMode = "light" | "dark" | "system"

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  hydrate: () => Promise<void>
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",

  setMode: (mode) => {
    colorScheme.set(mode)
    SecureStore.setItemAsync("theme_mode", mode)
    set({ mode })
  },

  hydrate: async () => {
    const stored = await SecureStore.getItemAsync("theme_mode")
    const mode: ThemeMode = stored === "light" || stored === "dark" ? stored : "system"
    colorScheme.set(mode)
    set({ mode })
  }
}))
