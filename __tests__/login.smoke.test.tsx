import { render } from "@testing-library/react-native"
import LoginScreen from "../app/(auth)/login"

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({})
}))

jest.mock("@/hooks/useGoogleAuth", () => ({
  useGoogleAuth: () => ({ signIn: jest.fn(), isLoading: false })
}))

jest.mock("@/hooks/useIsDesktop", () => ({
  useIsDesktop: () => false
}))

jest.mock("@/utils/storage", () => ({
  storage: {
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined)
  }
}))

describe("LoginScreen", () => {
  it("renders without crashing", async () => {
    const { getByText } = await render(<LoginScreen />)
    expect(getByText(/log in/i)).toBeTruthy()
  })
})
