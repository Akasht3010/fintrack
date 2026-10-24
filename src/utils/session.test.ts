// session.ts decides at import time from Platform.OS, so each case loads a
// fresh copy of it under the platform being tested.
function loadSession(os: "web" | "ios") {
  const store: Record<string, string> = {}
  let mod: typeof import("./session") | undefined
  jest.isolateModules(() => {
    // require(), not import: each case must load fresh copies inside isolateModules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Object.defineProperty(require("react-native").Platform, "OS", { value: os, configurable: true })
    jest.doMock("@/utils/storage", () => ({
      storage: {
        setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v }),
        deleteItemAsync: jest.fn(async (k: string) => { delete store[k] })
      }
    }))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("./session")
  })
  return { session: mod!, store }
}

describe("session (web)", () => {
  it("never persists a token and only sends the cookie-transport header", async () => {
    const { session, store } = loadSession("web")
    expect(session.usesCookieSession).toBe(true)
    expect(session.AUTH_TRANSPORT_HEADERS).toEqual({ "X-Auth-Transport": "cookie" })

    expect(session.cookieSessionAgeMs()).toBeNull()
    await session.saveSession(null)
    expect(store).toEqual({})
    expect(session.cookieSessionAgeMs()).toBeGreaterThanOrEqual(0)
  })

  it("clears a token an older web build left in localStorage", async () => {
    const { session, store } = loadSession("web")
    store.access_token = "legacy"
    await session.saveSession(null)
    await session.clearStoredSession()
    expect(store.access_token).toBeUndefined()
    expect(session.cookieSessionAgeMs()).toBeNull()
  })
})

describe("session (native)", () => {
  it("stores the bearer token and sends no transport header", async () => {
    const { session, store } = loadSession("ios")
    expect(session.AUTH_TRANSPORT_HEADERS).toEqual({})
    await session.saveSession("tok")
    expect(store.access_token).toBe("tok")
  })

  it("refuses a response with no token rather than silently signing in", async () => {
    const { session } = loadSession("ios")
    await expect(session.saveSession(null)).rejects.toThrow()
  })
})
