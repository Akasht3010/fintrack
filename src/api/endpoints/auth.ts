import { apiClient } from "@/api/client"
import { User } from "@/types/domain"

export interface SignupRequest {
  name: string
  email: string
  phone: string
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

  async getMe(): Promise<User> {
    const response = await apiClient.get<User>("/api/auth/me")
    return response.data
  },

  async refreshToken(): Promise<{ access_token: string }> {
    const response = await apiClient.post<{ access_token: string }>("/api/auth/refresh")
    return response.data
  }
}
