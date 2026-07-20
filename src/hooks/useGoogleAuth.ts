import { useState } from "react"
import * as WebBrowser from "expo-web-browser"
import * as AuthSession from "expo-auth-session"
import * as SecureStore from "expo-secure-store"
import { useUserStore } from "@/store/useUserStore"
import { ENV } from "@/config/env"
import { User } from "@/types/domain"

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userInfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo"
}

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setUser } = useUserStore()

  // ✅ Correct redirect URI for Expo Go
  const redirectUri = AuthSession.makeRedirectUri({
  scheme: undefined, // 👈 forces HTTPS instead of exp://
});

console.log(redirectUri);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: ENV.GOOGLE_CLIENT_ID_IOS, // ✅ MUST be Web Client ID
      redirectUri,
      scopes: ["openid", "profile", "email"], // ✅ Removed Gmail scope (for now)
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        access_type: "offline",
        prompt: "consent"
      }
    },
    GOOGLE_DISCOVERY
  )

  const signIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // ✅ Use proxy here (correct place in new API)
      const result = await promptAsync()

      if (result.type === "success") {
        const { code } = result.params

        // ✅ Exchange code for tokens
        const tokenResponse = await fetch(
          GOOGLE_DISCOVERY.tokenEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              code,
              client_id: ENV.GOOGLE_CLIENT_ID_WEB, // ✅ must match above
              redirect_uri: redirectUri,
              grant_type: "authorization_code"
            }).toString()
          }
        )

        const tokens = await tokenResponse.json()

        if (tokens.error) {
          throw new Error(tokens.error_description || "Token exchange failed")
        }

        // ✅ Fetch user info
        const userInfoResponse = await fetch(
          GOOGLE_DISCOVERY.userInfoEndpoint,
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`
            }
          }
        )

        const userInfo = await userInfoResponse.json()

        // ✅ Store tokens securely
        await SecureStore.setItemAsync("access_token", tokens.access_token)
        if (tokens.refresh_token) {
          await SecureStore.setItemAsync("refresh_token", tokens.refresh_token)
        }

        // ✅ Build user object
        const user: User = {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          avatar: userInfo.picture,
          gmailConnected: false, // ✅ since Gmail scope removed
          createdAt: new Date().toISOString()
        }

        await SecureStore.setItemAsync("user", JSON.stringify(user))
        setUser(user)

      } else if (result.type === "error") {
        setError(result.error?.message ?? "Authentication failed")
      }

    } catch (err: any) {
      setError(err.message ?? "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return { signIn, isLoading, error, request }
}