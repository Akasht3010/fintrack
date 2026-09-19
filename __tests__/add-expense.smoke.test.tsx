import { render, waitFor, fireEvent } from "@testing-library/react-native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AddExpenseScreen from "../app/(modals)/add-expense"
import { transactionApi } from "@/api/endpoints/transactions"
import { showAlert } from "@/utils/alert"

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({})
}))

jest.mock("@/api/endpoints/categories", () => ({
  categoriesApi: { list: jest.fn().mockResolvedValue([]) }
}))

jest.mock("@/api/endpoints/accounts", () => ({
  accountsApi: { list: jest.fn().mockResolvedValue([]), netWorth: jest.fn() }
}))

jest.mock("@/api/endpoints/transactions", () => ({
  transactionApi: {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}))

jest.mock("@/api/endpoints/budgets", () => ({
  budgetApi: { list: jest.fn().mockResolvedValue([]) }
}))

// budgetAlerts pulls in expo-notifications, which registers a native
// push-token listener on import (and warns loudly under Expo Go) —
// irrelevant to this screen's render path and leaves an open handle that
// keeps the test process alive.
jest.mock("@/utils/budgetAlerts", () => ({
  notifyBudgetThresholdCrossings: jest.fn()
}))

jest.mock("@/utils/alert", () => ({
  showAlert: jest.fn()
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("AddExpenseScreen", () => {
  it("renders without crashing", async () => {
    const { getAllByText } = await renderWithClient(<AddExpenseScreen />)
    await waitFor(() => expect(getAllByText("Add Expense").length).toBeGreaterThan(0))
  })

  it("rejects a non-numeric amount instead of submitting it as null", async () => {
    // Regression test for F-P0-2: handleSubmit previously only checked
    // amount.trim(), so "abc" sailed through parseFloat into `amount: NaN`
    // (-> JSON `null`) with no client-side error message.
    const { getAllByText, getByPlaceholderText } = await renderWithClient(<AddExpenseScreen />)
    await waitFor(() => expect(getAllByText("Add Expense").length).toBeGreaterThan(0))

    fireEvent.changeText(getByPlaceholderText("0.00"), "abc")
    fireEvent.press(getAllByText("Add Expense")[1])

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith("Error", "Please enter a valid amount"))
    expect(transactionApi.create).not.toHaveBeenCalled()
  })
})
