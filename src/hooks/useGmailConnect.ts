import { useState } from "react"
import { Platform } from "react-native"
import * as WebBrowser from "expo-web-browser"
import * as AuthSession from "expo-auth-session"
import * as Linking from "expo-linking"
import Constants from "expo-constants"
import { storage as SecureStore } from "@/utils/storage"
import { useUserStore } from "@/store/useUserStore"
import { ENV } from "@/config/env"
import { authApi } from "@/api/endpoints/auth"
import { gmailApi } from "@/api/endpoints/gmail"
import { extractErrorMessage } from "@/api/client"

WebBrowser.maybeCompleteAuthSession()

/**
 * Same backend-mediated pattern as useGoogleAuth: the app's own deep link
 * changes every Expo Go session, so the backend's fixed /callback handles
 * the actual OAuth round-trip and bounces back to the app's current URL.
 * Unlike login, the user is already authenticated here — but since
 * /authorize is opened as a top-level browser navigation (no room for an
 * Authorization header), we first fetch a one-time link token over a normal
 * authenticated request and pass *that* in the URL instead of the real
 * access token (see gmailApi.linkToken).
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
      const { link_token } = await gmailApi.linkToken()

      // Pin our custom scheme in a real build (`fintrack://gmail-callback`,
      // resolvable anywhere); in Expo Go fall back to the Expo Go redirect
      // form, since `fintrack://` isn't registered there. See useGoogleAuth
      // for the full rationale.
      const inExpoGo = Constants.appOwnership === "expo"
      const appRedirectUri = AuthSession.makeRedirectUri(
        inExpoGo ? { path: "gmail-callback" } : { scheme: "fintrack", path: "gmail-callback" }
      )
      const authorizeUrl = `${ENV.API_URL}/api/gmail/authorize?link_token=${encodeURIComponent(link_token)}&app_redirect_uri=${encodeURIComponent(appRedirectUri)}`

      if (Platform.OS === "web") {
        // Same reasoning as useGoogleAuth: popups are unreliable on web
        // (blocked by popup blockers/extensions, window.opener severed
        // across the cross-origin redirect chain), so use a full-page
        // redirect instead. gmail-callback.tsx handles landing back here.
        window.location.href = authorizeUrl
        return new Promise<GmailConnectResult>(() => {}) // page is navigating away
      }

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
      return { success: false, error: extractErrorMessage(err) }
    } finally {
      setIsLoading(false)
    }
  }

  return { connect, isLoading }
}
