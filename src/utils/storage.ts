import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

// expo-secure-store has no real web implementation (its web shim is an empty
// stub), so calling it there throws "is not a function". Fall back to
// localStorage on web — not secure storage, but fine for browser-based
// testing, which is all the web target is for here.
const isWeb = Platform.OS === "web"

export const storage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (isWeb) {
      return typeof window !== "undefined" ? window.localStorage.getItem(key) : null
    }
    return SecureStore.getItemAsync(key)
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (isWeb) {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value)
      return
    }
    await SecureStore.setItemAsync(key, value)
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (isWeb) {
      if (typeof window !== "undefined") window.localStorage.removeItem(key)
      return
    }
    await SecureStore.deleteItemAsync(key)
  }
}
