import { render, waitFor } from "@testing-library/react-native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AddExpenseScreen from "../app/(modals)/add-expense"

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

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe("AddExpenseScreen", () => {
  it("renders without crashing", async () => {
    const { getAllByText } = await renderWithClient(<AddExpenseScreen />)
    await waitFor(() => expect(getAllByText("Add Expense").length).toBeGreaterThan(0))
  })
})
