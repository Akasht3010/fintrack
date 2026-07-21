import { useState } from "react"
import * as WebBrowser from "expo-web-browser"
import * as AuthSession from "expo-auth-session"
import * as Linking from "expo-linking"
import * as SecureStore from "expo-secure-store"
import { useUserStore } from "@/store/useUserStore"
import { ENV } from "@/config/env"
import { authApi } from "@/api/endpoints/auth"

WebBrowser.maybeCompleteAuthSession()

/**
 * Same backend-mediated pattern as useGoogleAuth: the app's own deep link
 * changes every Expo Go session, so the backend's fixed /callback handles
 * the actual OAuth round-trip and bounces back to the app's current URL.
 * Unlike login, the user is already authenticated here — their existing
 * access token is passed as a query param so the backend knows which
 * account to attach the Gmail refresh token to.
 */
export interface GmailConnectResult {
  success: boolean
  error?: string
}

export function useGmailConnect() {
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useUserStore()

  const connect = async (): Promise<GmailConnectResult> => {
    setIsLoading(true)

    try {
      const accessToken = await SecureStore.getItemAsync("access_token")
      if (!accessToken) {
        return { success: false, error: "You need to be logged in to connect Gmail" }
      }

      const appRedirectUri = AuthSession.makeRedirectUri({ path: "gmail-callback" })
      const authorizeUrl = `${ENV.API_URL}/api/gmail/authorize?token=${encodeURIComponent(accessToken)}&app_redirect_uri=${encodeURIComponent(appRedirectUri)}`

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, appRedirectUri)

      if (result.type === "cancel" || result.type === "dismiss") {
        return { success: false }
      }

      if (result.type !== "success" || !result.url) {
        return { success: false, error: "Gmail connect failed" }
      }

      const params = Linking.parse(result.url).queryParams
      if (params?.gmail_connected !== "true") {
        return { success: false, error: typeof params?.error === "string" ? params.error : "Gmail connect failed" }
      }

      // Refresh the cached user so gmail_connected reflects the new state
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

  return { connect, isLoading }
}
