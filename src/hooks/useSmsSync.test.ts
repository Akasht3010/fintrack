import { isLikelyBankSms, redactOtp } from "./useSmsSync"

describe("isLikelyBankSms", () => {
  it("accepts a transaction alert from an alphanumeric bank sender id", () => {
    expect(isLikelyBankSms("HDFCBK", "Rs.500 debited from your account")).toBe(true)
  })

  it("accepts a transaction alert from a carrier-prefixed sender id", () => {
    expect(isLikelyBankSms("VM-ICICIB", "INR 1,200 credited")).toBe(true)
  })

  it("accepts a transaction alert from a numeric short code", () => {
    expect(isLikelyBankSms("567676", "You spent Rs 250 at Store")).toBe(true)
  })

  it("rejects a personal text from a phone number even if it mentions an amount", () => {
    // Regression test for F-P1-3: the currency-only filter used to let a
    // friend's "Rs 500 for dinner" text through and ship it to the backend.
    expect(isLikelyBankSms("+919876543210", "Rs 500 for dinner tonight?")).toBe(false)
  })

  it("rejects a message with no currency mention regardless of sender", () => {
    expect(isLikelyBankSms("HDFCBK", "Your card ending 1234 was used for a purchase")).toBe(false)
  })

  it("rejects when the sender address is missing", () => {
    expect(isLikelyBankSms(null, "Rs.500 debited")).toBe(false)
  })
})

describe("redactOtp", () => {
  it("redacts a code that appears before the word OTP", () => {
    expect(redactOtp("123456 is your OTP for login")).toBe("[REDACTED] is your OTP for login")
  })

  it("redacts a code that appears after the word OTP", () => {
    expect(redactOtp("HDFCBK: Your OTP is 654321. Do not share it.")).toBe(
      "HDFCBK: Your OTP is [REDACTED]. Do not share it."
    )
  })

  it("leaves an ordinary transaction alert with no OTP untouched", () => {
    const body = "Rs.500.00 debited from A/c XX1234 on 05-Sep-26. Avl Bal Rs.10,000.00"
    expect(redactOtp(body)).toBe(body)
  })
})
