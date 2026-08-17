import { create } from "zustand"
import { Appearance } from "react-native"
import { storage as SecureStore } from "@/utils/storage"
import { colorScheme } from "nativewind"

export type ThemeMode = "light" | "dark" | "system"

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  hydrate: () => Promise<void>
}

// On web, NativeWind's colorScheme.set() only toggles the `.dark` class on
// <html> when passed a literal "light"/"dark" — passing "system" removes the
// class unconditionally instead of resolving it, even though the JS-side
// colorScheme observable it drives correctly falls back to the OS scheme.
// That mismatch is invisible for components that read `useColorScheme()`
// (they see "dark" as expected) but silently breaks every Tailwind `dark:`
// class, since those depend on the DOM class actually being present. Always
// resolving to a concrete value before calling set() sidesteps it.
const resolveScheme = (mode: ThemeMode): "light" | "dark" =>
  mode === "system" ? (Appearance.getColorScheme() ?? "light") : mode

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",

  setMode: (mode) => {
    colorScheme.set(resolveScheme(mode))
    SecureStore.setItemAsync("theme_mode", mode)
    set({ mode })
  },

  hydrate: async () => {
    const stored = await SecureStore.getItemAsync("theme_mode")
    const mode: ThemeMode = stored === "light" || stored === "dark" ? stored : "system"
    colorScheme.set(resolveScheme(mode))
    set({ mode })
  }
}))

// "system" mode has no ongoing tie to the OS after the initial resolve above
// (colorScheme.set() only receives a fixed value, once) — without this, the
// app would stay on whichever scheme was active at hydrate/setMode time and
// never follow a live OS theme change until the next manual toggle.
Appearance.addChangeListener(({ colorScheme: scheme }) => {
  if (useThemeStore.getState().mode === "system") {
    colorScheme.set(scheme ?? "light")
  }
})
