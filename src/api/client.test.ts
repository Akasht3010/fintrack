import { isSessionExpiryResponse } from "./client"

describe("isSessionExpiryResponse", () => {
  it("treats 401/403 from ordinary endpoints as the session ending", () => {
    expect(isSessionExpiryResponse(401, "/api/transactions")).toBe(true)
    expect(isSessionExpiryResponse(403, "/api/auth/me")).toBe(true)
    expect(isSessionExpiryResponse(401, "/api/auth/refresh")).toBe(true)
    expect(isSessionExpiryResponse(401, "https://api.example.com/api/budgets?x=1")).toBe(true)
  })

  it("ignores wrong-credential 401s from the login/OTP endpoints", () => {
    for (const path of ["/api/auth/login", "/api/auth/verify-otp", "/api/auth/reset-password", "/api/auth/google/exchange", "/api/auth/logout"]) {
      expect(isSessionExpiryResponse(401, path)).toBe(false)
    }
  })

  it("ignores other statuses", () => {
    expect(isSessionExpiryResponse(400, "/api/transactions")).toBe(false)
    expect(isSessionExpiryResponse(undefined, "/api/transactions")).toBe(false)
  })
})
