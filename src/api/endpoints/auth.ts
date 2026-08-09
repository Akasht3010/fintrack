import { apiClient } from "@/api/client"
import { User } from "@/types/domain"

export interface SignupRequest {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

export interface SignupResponse {
  access_token: string
  user: User
}

export interface LoginRequest {
  identifier: string
  password: string
}

// Step 1 of login: password checked, OTP emailed — no access token yet.
export interface LoginPendingResponse {
  pending_token: string
  email_hint: string
  message: string
}

export interface VerifyOtpRequest {
  pendingToken: string
  code: string
}

// Step 2 of login: OTP confirmed, this is the real session.
export interface VerifyOtpResponse {
  access_token: string
  user: User
}

export interface ForgotPasswordRequest {
  identifier: string
}

// Step 1 of password reset: identity confirmed, OTP emailed — no session yet.
export interface ForgotPasswordResponse {
  pending_token: string
  email_hint: string
  message: string
}

export interface ResetPasswordRequest {
  pendingToken: string
  code: string
  newPassword: string
  confirmNewPassword: string
}

// Step 2 of password reset: OTP confirmed, password changed, logged in.
export interface ResetPasswordResponse {
  access_token: string
  user: User
}

export interface UpdateProfileRequest {
  name?: string
  email?: string
  phone?: string
}

export const authApi = {
  async signup(data: SignupRequest): Promise<SignupResponse> {
    const response = await apiClient.post<SignupResponse>(
      "/api/auth/signup",
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        confirm_password: data.confirmPassword
      }
    )
    return response.data
  },

  async updateMe(data: UpdateProfileRequest): Promise<User> {
    const response = await apiClient.patch<User>("/api/auth/me", data)
    return response.data
  },

  async deleteMe(): Promise<void> {
    await apiClient.delete("/api/auth/me")
  },

  async login(data: LoginRequest): Promise<LoginPendingResponse> {
    const response = await apiClient.post<LoginPendingResponse>(
      "/api/auth/login",
      data
    )
    return response.data
  },

  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const response = await apiClient.post<VerifyOtpResponse>(
      "/api/auth/verify-otp",
      { pending_token: data.pendingToken, code: data.code }
    )
    return response.data
  },

  async resendOtp(pendingToken: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      "/api/auth/resend-otp",
      { pending_token: pendingToken }
    )
    return response.data
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const response = await apiClient.post<ForgotPasswordResponse>(
      "/api/auth/forgot-password",
      data
    )
    return response.data
  },

  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const response = await apiClient.post<ResetPasswordResponse>(
      "/api/auth/reset-password",
      {
        pending_token: data.pendingToken,
        code: data.code,
        new_password: data.newPassword,
        confirm_new_password: data.confirmNewPassword
      }
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
