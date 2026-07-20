import axios from "axios"
import * as SecureStore from "expo-secure-store"
import { ENV } from "@/config/env"

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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("access_token")
      await SecureStore.deleteItemAsync("refresh_token")
    }
    return Promise.reject(error)
  }
)
