import { useState } from "react"
import * as WebBrowser from "expo-web-browser"
import * as AuthSession from "expo-auth-session"
import * as Linking from "expo-linking"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { ENV } from "@/config/env"
import { authApi } from "@/api/endpoints/auth"

WebBrowser.maybeCompleteAuthSession()

/**
 * Google sign-in is mediated by the backend rather than done purely
 * client-side: Google requires a stable https (or localhost) redirect URI,
 * but Expo Go's own deep link changes every session (exp://<lan-ip>:8081/...).
 * So the app opens the backend's /api/auth/google/authorize, which redirects
 * to Google; Google redirects back to the backend's fixed /callback; and the
 * backend then redirects the browser to *our* dynamic deep link with our own
 * JWT attached, which WebBrowser.openAuthSessionAsync catches.
 */
export interface GoogleSignInResult {
  success: boolean
  error?: string
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useUserStore()

  const signIn = async (): Promise<GoogleSignInResult> => {
    setIsLoading(true)

    try {
      const appRedirectUri = AuthSession.makeRedirectUri({ path: "auth-callback" })
      const authorizeUrl = `${ENV.API_URL}/api/auth/google/authorize?app_redirect_uri=${encodeURIComponent(appRedirectUri)}`

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, appRedirectUri)

      if (result.type === "cancel" || result.type === "dismiss") {
        return { success: false }
      }

      if (result.type !== "success" || !result.url) {
        return { success: false, error: "Google sign-in failed" }
      }

      const token = Linking.parse(result.url).queryParams?.token
      if (!token || typeof token !== "string") {
        return { success: false, error: "Google sign-in did not return a token" }
      }

      await SecureStore.setItemAsync("access_token", token)
      const user = await authApi.getMe()
      await SecureStore.setItemAsync("user", JSON.stringify(user))
      setUser(user)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message ?? "Something went wrong" }
    } finally {
      setIsLoading(false)
    }
  }

  return { signIn, isLoading }
}
