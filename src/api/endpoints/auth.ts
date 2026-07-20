import { apiClient } from "@/api/client"
import { User } from "@/types/domain"
import * as SecureStore from "expo-secure-store"

export interface SignupRequest {
  name: string
  email: string
  phone?: string
}

export interface SignupResponse {
  access_token: string
  user: User
}

export interface LoginRequest {
  identifier: string
}

export interface LoginResponse {
  access_token: string
  user: User
}

export const authApi = {
  async signup(data: SignupRequest): Promise<SignupResponse> {
    const response = await apiClient.post<SignupResponse>(
      "/api/auth/signup",
      data
    )
    return response.data
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      "/api/auth/login",
      data
    )
    return response.data
  },

  async getMe(userId: string): Promise<User> {
    const response = await apiClient.get<User>(
      `/api/auth/me?user_id=${userId}`
    )
    return response.data
  },

  async refreshToken(userId: string): Promise<{ access_token: string }> {
    const response = await apiClient.post<{ access_token: string }>(
      `/api/auth/refresh?user_id=${userId}`
    )
    return response.data
  }
}
