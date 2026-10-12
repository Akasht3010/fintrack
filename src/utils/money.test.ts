import { parseMoneyInput } from "./money"

describe("parseMoneyInput", () => {
  it("accepts whole and 2-decimal amounts, including negatives", () => {
    expect(parseMoneyInput("1500")).toBe(1500)
    expect(parseMoneyInput(" 99.5 ")).toBe(99.5)
    expect(parseMoneyInput("-250.75")).toBe(-250.75)
    expect(parseMoneyInput("0")).toBe(0)
  })

  it("rejects input parseFloat would silently coerce", () => {
    expect(parseMoneyInput("")).toBeNull()
    expect(parseMoneyInput("abc")).toBeNull()
    expect(parseMoneyInput("12abc")).toBeNull()
    expect(parseMoneyInput("1.234")).toBeNull()
    expect(parseMoneyInput("1,000")).toBeNull()
  })
})
