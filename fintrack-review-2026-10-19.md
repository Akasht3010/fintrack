# Fintrack Weekly Code Review - 2026-10-19

## Summary

Both repos were available and reviewed: `fintrack` (React Native/Expo + TypeScript) at `a9203e4ebcd793180e4993757e98ead565141292`, and `fintrack-backend` (FastAPI) at `c9c9a7ac7d17aef19405fe465a6d31efe844204d`. This codebase has clearly been through several prior review passes — Decimal/NUMERIC discipline, IDOR guards, token revocation, OAuth state handling, and OTP/2FA on the backend are all solid, and the frontend's decimal-safe money math, refresh-token race handling, and SMS privacy redaction are well engineered. The two headline findings this week are both frontend regressions/gaps that slipped past those prior passes: **logout doesn't clear the React Query cache**, so a second user signing in on the same device within the 5-minute stale window can see the first user's balances, net worth, budgets, and recurring bills; and **Add Expense / Add Budget still validate amounts with raw `parseFloat`** instead of the stricter `parseMoneyInput` helper that was already backported to the accounts screen in the very last commit on `main` — reopening the `Infinity`/scientific-notation bug class a recent commit (`ab6ba2e`) claimed to have closed. No secrets were found in either repo. Static analysis tooling (pytest/mypy/pip-audit on the backend, npm lint/tsc/audit on the frontend) could not run because dependencies aren't installed in this environment — findings below come from `ruff` (installed) plus manual reading; this is noted explicitly so results aren't mistaken for a from-scratch static-analysis pass.

## Critical (P0) - fix before deploy

- **[fintrack/src/store/useUserStore.ts:24-38]** Logout never clears the React Query cache — the next user on the same device sees the previous user's money data.
  Why it matters: The app-wide `QueryClient` (`app/_layout.tsx:23-29`) is configured with `staleTime: 5 * 60 * 1000` and most query keys are **not** scoped by `user.id` — `["accounts", ...]`/`["net-worth"]` (`src/hooks/useAccounts.ts:7,14`), `["budgets"]` (`app/(tabs)/budget.tsx:31`, `app/(modals)/add-budget.tsx:22`), `["insights"]`/`["recurring"]` (`app/(tabs)/insights.tsx:27,32`), `["categories", type]` (`src/hooks/useCategories.ts:10`). Only `transactions` includes `user.id`, and even that is inconsistent (see P1 below). On a shared/family device, User A logs out and User B logs in within 5 minutes: Budget, Insights, Accounts/Net-Worth, and Recurring screens render instantly from the stale in-memory cache — no refetch is even triggered on mount — showing User A's account balances, net worth, budget limits/spend, and recurring merchants to User B. This is a direct cross-tenant PII/financial-data leak on a single device, the most serious class of bug a personal-finance app can have.
  Fix:
  ```ts
  // src/store/useUserStore.ts
  import { queryClient } from "@/api/queryClient" // hoist the QueryClient out of app/_layout.tsx so it's importable here

  logout: async () => {
    try {
      await authApi.logout()
    } catch { /* local logout must still succeed */ }
    await SecureStore.deleteItemAsync("access_token")
    await SecureStore.deleteItemAsync("user")
    queryClient.clear()
    set({ user: null, isAuthenticated: false, isLoading: false })
  }
  ```
  As a second layer, scope every query key by `user.id` (the way `transactions` partially does) so a missed `clear()` anywhere else doesn't reopen this.

- **[fintrack/app/(modals)/add-expense.tsx:78-80, fintrack/app/(modals)/add-budget.tsx:48-50]** Amount validation uses raw `parseFloat` instead of the already-fixed `parseMoneyInput`, reopening the exact bug class just patched elsewhere.
  Why it matters: `src/utils/money.ts:18-22`'s `parseMoneyInput` strictly matches `^-?\d+(\.\d{1,2})?$`; `parseFloat` does not. Typing `Infinity` into the Amount field passes this screen's check (`isNaN(Infinity)` is `false`, `Infinity <= 0` is `false`), but `JSON.stringify({amount: Infinity})` serializes to `{"amount":null}` — reproducing, via a different input, the exact bug commit `ab6ba2e` ("Validate the amount field before submitting an expense") was written to close. Scientific notation (`1e3`, `1e5`) also parses silently via `parseFloat` into 1000/100000 with no error shown, so a stray keystroke becomes a wildly wrong transaction or budget amount. The latest commit on `main` (`a9203e4`, "Reject invalid opening balances instead of saving them as ₹0") already backported `parseMoneyInput` to `app/(modals)/accounts.tsx` for this exact reason but missed these two screens — which are the two most-used money-entry forms in the app. The existing smoke test (`__tests__/add-expense.smoke.test.tsx:55-67`) only covers `"abc"`, not `"Infinity"`/`"1e3"`, so this regression has no test coverage.
  Fix:
  ```ts
  import { parseMoneyInput } from "@/utils/money"
  // add-expense.tsx
  const parsedAmount = parseMoneyInput(amount)
  if (parsedAmount === null || parsedAmount <= 0) {
    showAlert("Error", "Please enter a valid amount")
    return
  }
  // add-budget.tsx — same pattern for limitAmount
  ```

## High (P1) - fix this sprint

- **[fintrack-backend/app/services/budget_service.py:59-67, fintrack-backend/app/models/budget.py]** Budgets have no DB-level uniqueness constraint — a race condition can create duplicate active budgets for the same category/period.
  Why it matters: `create_budget` only does an app-level check-then-insert (SELECT existing budget, then INSERT if none found). `Transaction` has an explicit partial unique index specifically to close this exact race (`app/models/transaction.py:40-53`), but `Budget` has no equivalent. Two concurrent `POST /api/budgets` calls (a double-tap on a slow connection, or a client retry) for the same category/period can both pass the SELECT and both INSERT, producing two "active" budgets that confuse `spent_amount` tracking in the UI and make `DuplicateBudgetError` unreliable exactly when it matters (concurrent requests).
  Fix: add a partial unique index on `(user_id, category, period)` scoped to the active window, or at minimum catch `IntegrityError` on insert and convert it to `DuplicateBudgetError`, mirroring the pattern already used for `Transaction`.

- **[fintrack-backend/app/schemas/transaction.py:23-24]** `merchant` and `description` on manual transaction create/update have no length bound.
  Why it matters: Every other free-text field in the schema layer is bounded (`Category.name` ≤ 40, `Account.name` ≤ 60, `idempotency_key` ≤ 100), and the gmail/sms import paths explicitly truncate these same fields (`app/services/email_parser.py:201-202`), but the manual-entry `TransactionCreate`/`TransactionUpdate` schemas leave `merchant: str` / `description: str` unbounded, and `app/main.py` sets no request body size limit. An authenticated client can POST transactions with multi-MB merchant/description strings repeatedly, bloating a money-ledger table that's read on every list/export/insights call and fully materialized in memory for CSV export (`app/api/transactions.py:168-211`).
  Fix: `merchant: str = Field(max_length=100)`, `description: str = Field(max_length=200)` on `TransactionBase`/`TransactionUpdate`, matching the import-path truncation limits.

- **[fintrack/src/utils/storage.ts:12-13,19-20]** Access token (JWT) is stored in `window.localStorage` on the web build.
  Why it matters: The comment calls this "fine for browser-based testing, which is all the web target is for here," but the web target is a real shipped artifact — `package.json`'s `deploy` script (`expo export -p web && wrangler deploy`) and `wrangler.jsonc` push it to Cloudflare, and `src/config/env.ts` documents per-environment (`production`/`preview`) API URLs specifically for this build. `localStorage` has no `HttpOnly` protection, so any XSS on the web build (a future dependency CVE, a CSP misconfiguration, a compromised npm package) can exfiltrate the session token directly via `localStorage.getItem("access_token")`. Mobile correctly uses `expo-secure-store`; only the shipped web build is exposed.
  Fix: at minimum, gate the `localStorage` fallback behind an explicit non-production check and refuse to run in a production web build without it; longer-term, move the web target to an httpOnly-cookie-based session instead of a client-readable token.

- **[fintrack/src/hooks/useCreateTransaction.ts:15 vs app/(modals)/add-expense.tsx:100, src/hooks/useGmailSync.ts:29, src/hooks/useSmsSync.ts:100, app/(modals)/categories.tsx:26]** Inconsistent React Query key scoping for transactions: one invalidation path includes `user.id`, every sibling path doesn't.
  Why it matters: `useCreateTransaction` invalidates `["transactions", user.id]`, but the actively-rendered list query is keyed `["transactions", user?.id, selectedCategory, debouncedSearch, dateRange, minAmount, maxAmount]` (`app/(tabs)/transactions.tsx:58`), and Gmail sync, SMS sync, and category edits all invalidate the bare `["transactions"]`. A partial-key `invalidateQueries` call does match broader descendant keys in React Query, so this mostly works by accident today, but it's fragile and is the same root inconsistency behind the P0 cache-leak issue above — a future refactor that tightens key matching will silently break sync-triggered refreshes.
  Fix: standardize every transaction-related query key and invalidation call to key off `user.id` consistently (and clear this up at the same time as the P0 logout fix).

## Medium (P2) - worth doing

- **[fintrack-backend/app/schemas/insights.py, fintrack-backend/app/schemas/recurring.py, fintrack-backend/app/api/insights.py:59,87,109]** Insights/recurring endpoints serialize money totals as `float`, not the app's own `Money` (Decimal-string) convention used everywhere else (`transactions`, `accounts`, `budgets`). `recurring_service.py` explicitly justifies its one float use as a derived *ratio*, not a displayed amount, but `insights.py`'s monthly/category/merchant totals and `monthly_total` have no such justification and are literal `SUM()`s of real money displayed as dashboard headline numbers. Low risk today (display-only, frontend consumes them through `decimal.js`-backed `formatCurrency` so nothing breaks visibly), but it contradicts the app's own stated invariant and risks a `1234.5600000000004`-style artifact as transaction volume grows. Fix: serialize via the `Money` type like every other money field, or at minimum `Decimal`-quantize before building the response.
- **[fintrack-backend/app/api/gmail.py:196-204]** The one blind `except Exception: email_date = now_ist()` in this file has no logging at all, unlike the `logger.exception(...)` calls elsewhere in the same file. A malformed/missing `Date` header on a bank email silently reassigns the transaction's date to "now," which can misfile it into the wrong budget period or insights month with zero server-side trace. Fix: add `logger.warning(...)` before falling back.
- **[fintrack-backend/app/api/auth.py:175]** Login rate-limiting is per-IP only (10/min), with no per-account counter — a distributed attacker can spread password-guessing across many IPs against one victim. Materially mitigated by the mandatory OTP second factor and the OTP's own 5-attempt cap, but worth a per-identifier counter for defense in depth.
- **[fintrack/src/api/endpoints/transactions.ts:96-103]** `exportCsv` is the one GET endpoint that doesn't accept/forward an `AbortSignal`, unlike every other GET (`accounts`, `budgets`, `categories`, `insights`, `recurring`, `transactions.list/getById` all do per commit `bd1042d`). Low impact since it's a one-shot button gated by `isExporting`, but it's the one GET that commit missed.
- **[fintrack/src/api/endpoints/auth.ts:139-142]** `authApi.getMe()` also takes no `signal`; low risk (bootstrap/auth call, not a list render), but worth it for consistency with the "every GET" goal.
- **[fintrack/src/api/endpoints/budgets.ts:16-26, fintrack/src/api/endpoints/accounts.ts:16-23]** `idempotency_key` is wired into transaction create (`src/utils/idempotencyKey.ts` + `add-expense.tsx`) but not into budget create/update or account create/update — a retried request after a timeout can double-create a budget or double-apply an opening-balance edit with no server-side dedup available. Fix: extend the same pattern, assuming the backend adds equivalent unique-index coverage for budgets (see the P1 budget race fix above, which would need to land first).

## Cross-repo contract issues

No endpoint, method, field-name, or error-envelope drift was found between the two repos — the endpoint inventory (`fintrack-backend/app/api/*.py` route decorators) and the frontend call inventory (`fintrack/src/api/endpoints/*.ts`) line up one-to-one, including snake_case field names on both sides, consistent pagination (`page`/`limit`), and the `extractErrorMessage` helper (`fintrack/src/api/client.ts:22-36`) correctly handling both the plain-string `{detail}` shape and the array-of-`{msg}` Pydantic 422 shape. Two things worth flagging as *latent* risk rather than active breakage:
- **[fintrack-backend/app/schemas/insights.py <-> fintrack/src/types/domain.ts:97-137]** Backend serializes insights/recurring totals as JSON numbers (float); frontend types (`MonthlyTotal.total: number`, `RecurringItem.average_amount: number`) correctly match that today, so nothing is broken — but if the backend is ever changed to adopt the `Money` string convention here (per the P2 finding above) without a coordinated frontend change, every consumer of these two endpoints would need updating at the same time, since the rest of the app assumes string-money and parses with `Decimal`.
- **[fintrack-backend/app/utils/timezone.py <-> fintrack/src/utils/date.ts]** The backend deliberately returns naive IST-wall-clock timestamps with no UTC offset (by design, documented in both files), and the frontend correctly parses them via `dayjs.tz(date, "Asia/Kolkata")` rather than a bare `new Date(...)` — this is *not* a bug, just flagging it as the one place a generic "ISO 8601 with timezone" expectation doesn't hold, and confirming both sides already agree on why.

## Nits & style

- `fintrack-backend`: `ruff check app/` reports 212 findings, dominated by `B008` (77× — FastAPI's normal `Depends()` default-argument pattern, not a real issue) and `UP045`/`I001`/`UP006`/`UP035` (pure style/import-order, auto-fixable). The handful of real candidates (`BLE001` blind-except, `S110` try/except/pass) are all addressed individually above or in the backend agent's scope notes as deliberate, commented tradeoffs.
- `fintrack-backend/app/api/auth.py:389-394`, `app/api/gmail.py:105-112`, `app/services/gmail_service.py:105-107,122-124` — best-effort exception handlers use `print()`/no logging instead of the `logger` module used elsewhere in the same files. Functionally fine, visible in container stdout, but inconsistent for centralized log grepping.
- `fintrack/src/api/client.ts:97-104` — if `refreshAccessToken` fails, `getFreshAccessToken` returns the stale/expiring token rather than `null`, guaranteeing one failed round-trip before the real 401→logout flow triggers. Intentional per the comment; just a minor UX cost, not a bug.
- `fintrack/app/(modals)/edit-profile.tsx:115-121`, `add-expense.tsx:312-318`, `add-budget.tsx:175-181`, `delete-account.tsx:98-104` — cancel/secondary buttons lack `accessibilityRole="button"` while primary submit buttons mostly have it. Low severity (`TouchableOpacity` is accessible by default on most platforms) but worth a pass for consistency.
- `fintrack-backend/app/models/budget.py` — no index on `category` even though queries filter on it alongside `user_id`; low priority since budgets-per-user is small and bounded by category count.

## What looks good

- **End-to-end Decimal discipline for core money paths.** `Transaction.amount`, `Account.opening_balance`, and `Budget.limit_amount/spent_amount/remaining_amount` are all `Numeric(12,2)`, never `Float`; the `Money` Pydantic type serializes as a JSON string specifically to stop client-side float drift; and `tests/test_money_precision.py` proves no drift across 30 accumulated transactions. The frontend mirrors this with `decimal.js`-backed `money.ts`/`currency.ts` and a single pinned `Intl.NumberFormat("en-IN", ...)` formatter — no stray `toFixed(2)`-on-float anywhere in the app.
- **Token revocation and 2FA are both genuinely well-designed.** `token_version` embedded in every JWT and checked on every request invalidates outstanding sessions instantly on logout or password reset (with a thoughtful backward-compatible fallback for pre-revocation tokens); OTP codes are hashed, compared with `hmac.compare_digest`, and capped at 5 attempts with an expiry.
- **IDOR protection is consistent and tested on both repos' most important surfaces.** Every account/transaction/budget/category read/write route filters by `user_id == current_user.id`, with explicit regression tests (`test_accounts.py::test_cannot_{read,update,delete}_another_users_account`, `test_transactions.py::test_cannot_delete_another_users_transaction`).
- **OAuth state handling is notably careful**: server-side random nonces, single-use delete-wins race protection, encrypted payloads, an exchange-code pattern so a real JWT never travels in a redirect URL, and an explicit redirect-URI allowlist.
- **The refresh-token race on the frontend is correctly implemented** (`src/api/client.ts:97-104`): the check-and-set of the shared `refreshPromise` happens synchronously before the first `await`, so concurrent near-expiry requests genuinely share one refresh call instead of firing N parallel refreshes.

## Suggested next steps

1. Fix the two P0s first — they're both small, localized changes: wire `queryClient.clear()` into `useUserStore.logout()`, and swap `parseFloat` for `parseMoneyInput` in `add-expense.tsx`/`add-budget.tsx`.
2. Add a regression test for each P0 while fixing it: a "second user after logout sees no stale cached data" test, and an "`Infinity`/`1e3` input is rejected" case alongside the existing `"abc"` case in `add-expense.smoke.test.tsx`.
3. Add the budget uniqueness constraint (P1) and the `merchant`/`description` length bounds (P1) in the backend — both are small, additive schema/migration changes with no behavior change for valid input.
4. Decide on a real plan for the web build's token storage (P1) — either explicitly mark it non-production, or move to httpOnly cookies — before the web deploy path sees real user traffic, if it doesn't already.
5. Standardize React Query key scoping by `user.id` across accounts/budgets/insights/recurring/categories once the P0 logout fix lands, so the fix doesn't rely solely on `queryClient.clear()` as the only safety net.
6. Once dependencies can be installed in a review environment (or in CI), re-run `mypy`, `pytest`, `pip-audit`, `npm run lint`, `tsc --noEmit`, and `npm audit` — none of these could execute this week due to missing `node_modules`/Python packages in the container, so this review's ground truth was `ruff` plus manual reading only.
