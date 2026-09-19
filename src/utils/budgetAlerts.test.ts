import { notifyBudgetThresholdCrossings } from "./budgetAlerts"
import { sendBudgetAlert } from "./notifications"
import { Budget } from "@/types/domain"

jest.mock("./notifications", () => ({
  sendBudgetAlert: jest.fn()
}))

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 1,
    user_id: 1,
    category: "food",
    limit_amount: "100.00",
    spent_amount: "0.00",
    remaining_amount: "100.00",
    period: "monthly",
    start_date: "2026-09-01T00:00:00",
    end_date: "2026-09-30T23:59:59",
    ...overrides
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("notifyBudgetThresholdCrossings", () => {
  it("fires an alert when spend crosses the 80% threshold", async () => {
    const before = [makeBudget({ spent_amount: "70.00" })]
    const after = [makeBudget({ spent_amount: "85.00" })]

    await notifyBudgetThresholdCrossings(before, after)

    expect(sendBudgetAlert).toHaveBeenCalledTimes(1)
    expect(sendBudgetAlert).toHaveBeenCalledWith(
      expect.stringContaining("80%"),
      expect.any(String)
    )
  })

  it("does not re-fire the 80% alert once already past it", async () => {
    const before = [makeBudget({ spent_amount: "85.00" })]
    const after = [makeBudget({ spent_amount: "90.00" })]

    await notifyBudgetThresholdCrossings(before, after)

    expect(sendBudgetAlert).not.toHaveBeenCalled()
  })

  it("fires the exceeded alert, not the 80% one, when spend jumps straight past 100%", async () => {
    const before = [makeBudget({ spent_amount: "50.00" })]
    const after = [makeBudget({ spent_amount: "150.00" })]

    await notifyBudgetThresholdCrossings(before, after)

    expect(sendBudgetAlert).toHaveBeenCalledTimes(1)
    expect(sendBudgetAlert).toHaveBeenCalledWith(
      expect.stringContaining("exceeded"),
      expect.any(String)
    )
  })

  it("skips a zero-limit budget instead of dividing by zero", async () => {
    const before = [makeBudget({ limit_amount: "0.00", spent_amount: "0.00" })]
    const after = [makeBudget({ limit_amount: "0.00", spent_amount: "10.00" })]

    await notifyBudgetThresholdCrossings(before, after)

    expect(sendBudgetAlert).not.toHaveBeenCalled()
  })
})
