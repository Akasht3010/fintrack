import { formatCurrency } from "./currency"

describe("formatCurrency", () => {
  it("formats a whole number with no decimal places", () => {
    expect(formatCurrency(1000)).toBe("₹1,000")
  })

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("₹0")
  })

  it("formats a large number with Indian digit grouping", () => {
    expect(formatCurrency(1234567)).toBe("₹12,34,567")
  })

  it("formats fractional paise, without padding a trailing zero", () => {
    expect(formatCurrency(99.5)).toBe("₹99.5")
  })

  it("caps at two decimal places", () => {
    expect(formatCurrency(99.567)).toBe("₹99.57")
  })

  it("rounds beyond two decimal places", () => {
    expect(formatCurrency(99.999)).toBe("₹100")
  })

  it("formats a negative amount", () => {
    expect(formatCurrency(-500)).toBe("-₹500")
  })

  it("formats a decimal-string amount, as the API now sends", () => {
    expect(formatCurrency("1234.50")).toBe("₹1,234.5")
  })

  it("does not lose precision on a decimal string a float can't represent exactly", () => {
    expect(formatCurrency("19.99")).toBe("₹19.99")
  })
})
