import axios from "axios"
import { Alert } from "react-native"
import { storage as SecureStore } from "@/utils/storage"
import { ENV } from "@/config/env"
import { useUserStore } from "@/store/useUserStore"

export const apiClient = axios.create({
  baseURL: ENV.API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json"
  }
})

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Access tokens expire (30 min server-side) and there's no refresh-token
// flow, so an auth failure here always means the session is dead. Without
// this, the UI stayed on whatever authenticated screen the user was on
// while every request silently failed with a generic "not authenticated"
// error. Both statuses matter: our own get_current_user raises 401 for an
// expired/invalid token, but FastAPI's HTTPBearer raises 403 by default
// when the Authorization header is missing entirely — which is exactly
// what happens on the next request after this handler clears the token.
// The app never uses 403 for anything else, so it's safe to treat both as
// "session's over."
let isHandlingSessionExpiry = false

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    if ((status === 401 || status === 403) && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true
      const wasAuthenticated = useUserStore.getState().isAuthenticated
      await useUserStore.getState().logout()
      // Only alert if this cut a session actively in use — a cold start
      // with an already-expired stored token has isAuthenticated false the
      // whole time, and should just quietly land on the login screen.
      if (wasAuthenticated) {
        Alert.alert("Session expired", "Please log in again.")
      }
      isHandlingSessionExpiry = false
    }
    return Promise.reject(error)
  }
)
