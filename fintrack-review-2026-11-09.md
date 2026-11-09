# Fintrack Weekly Code Review - 2026-11-09

## Summary
Both repositories are **unchanged since the 2026-10-26 and 2026-11-02 reviews** — `fintrack` is still at commit `8a37d4c9d34bf445a51304b3212c502b29e55a84` and `fintrack-backend` is still at `0dd0ce4a66645cc14f42570fef2e1518ee99d7de` (last commit on either repo: 2026-10-25). This is the third consecutive weekly review of identical code, and all six prior weekly-review PRs (#5–#10, 2026-10-05 through 2026-11-02) are still **open and unmerged**. This review re-verified the codebase directly (not just copied prior findings) and confirms the headline issue from the last two cycles is still live in production code: **logout does not clear the React Query cache, and most non-transaction query keys aren't scoped by user id**, so a previous user's real financial data can render for the next person who logs in on the same device — a direct cross-user PII/financial-data leak that has now gone three weeks without a fix landing. Both repos remain otherwise well-engineered (Decimal-only money math, consistent IDOR checks, mature auth/OTP/OAuth-state handling), so this review focuses on confirming open findings are still accurate, flagging the stale-PR backlog, and surfacing anything missed previously.

## Critical (P0) - fix before deploy
- **[fintrack/src/store/useUserStore.ts:25-41]** `logout()` still never calls `queryClient.clear()`, and `app/_layout.tsx:26` still creates the single `QueryClient` with no reference exposed to the store. Most per-user queries are still unscoped by user id: `["budgets"]` (`app/(tabs)/budget.tsx:31`, `app/(modals)/add-budget.tsx:23`), `["insights"]`/`["recurring"]` (`app/(tabs)/insights.tsx:27,32`), `["accounts", ...]`/`["net-worth"]` (`src/hooks/useAccounts.ts:7,14`), `["categories", ...]` (`src/hooks/useCategories.ts:10`). Only `["transactions", user?.id, ...]` (`app/(tabs)/transactions.tsx:58`, `app/(tabs)/index.tsx:65`) is namespaced.
  Why it matters: on a shared/handed-off device, User B logging in right after User A logs out can see User A's real budgets, account balances, net worth, insights, and category list until each query's `staleTime` (5 minutes, `app/_layout.tsx:30`) expires and it refetches. This is the single most serious finding across three review cycles and is still unaddressed in the shipped code.
  Fix (unchanged from prior cycles — still correct):
  ```ts
  // src/store/useUserStore.ts
  logout: async (queryClient: QueryClient) => {
    try {
      await authApi.logout()
    } catch {
      if (usesCookieSession) await authApi.clearSession().catch(() => {})
    }
    await clearStoredSession()
    await SecureStore.deleteItemAsync("user")
    queryClient.clear()
    set({ user: null, isAuthenticated: false, isLoading: false })
  }
  ```
  Also namespace every per-user query key by `user.id` (`["budgets", user?.id]`, `["accounts", user?.id]`, etc.) as defense-in-depth even after the clear-on-logout fix lands.

## High (P1) - fix this sprint
- **[fintrack/src/utils/storage.ts:8-31]** Confirmed still present: on web, `storage` falls back to `window.localStorage` for *every* key, not just the token. `app/auth-callback.tsx:38` (and `gmail-callback.tsx`, `profile.tsx`, `edit-profile.tsx`) still persist the full `user` object (name, email, `gmail_connected`) via `SecureStore.setItemAsync("user", ...)`, which resolves to plaintext `localStorage` on the web build.
  Why it matters: this is PII sitting in persistent, non-HttpOnly browser storage, readable by any XSS or malicious extension — reopening exactly the attack surface the project's own "no token in localStorage" convention was built to close, just on the profile object instead of the token.
  Fix: keep `user` in memory (the Zustand store) on web and refetch via `GET /api/auth/me` on load, instead of persisting it through the generic `storage` wrapper.

- **[fintrack/app/auth-callback.tsx:33-44]** Confirmed still present: `finish()` unconditionally calls `authApi.exchangeGoogleCode(code)` for whatever `code` appears in the URL, with no client-side state/nonce verification tying the code back to a flow this device initiated.
  Why it matters: this is a login-CSRF primitive — an attacker who starts their own Google OAuth flow and gets a victim to open the resulting `fintrack://auth-callback?code=...` link can sign the victim's device into the attacker's account. The backend's server-side OAuth-state nonce (`app/utils/oauth_state.py`) protects against redirect forgery but does nothing to stop this, since the client never checks a state value on return.
  Fix: generate a nonce client-side before navigating to `authorizeUrl` (`useGoogleAuth.ts`, `useGmailConnect.ts`), persist it for the flow's duration, and verify it's echoed back before trusting `exchangeGoogleCode`'s result.

- **[fintrack-backend/requirements.txt:19]** Still pinned to `python-multipart==0.0.6`, below the `0.0.9` fix for a multipart-boundary ReDoS (GHSA-qgvh-v25w-33v4). FastAPI's form/file parsing depends on this package, and the app is pinned to `--max-instances=1` on Cloud Run (`cloudbuild.yaml`), so a single crafted multipart request is a real single-instance availability risk.
  Fix: bump to `python-multipart>=0.0.9` and smoke-test any form-consuming endpoint.

- **[fintrack-backend/app/api/sms.py:21, app/api/gmail.py:119]** Confirmed still unrated-limited, unlike every route in `auth.py` (`@limiter.limit("10/minute")`). `/api/sms/sync` accepts up to `MAX_SMS_PER_SYNC=500` messages per call; `/api/gmail/sync` makes a live Gmail API call per sync.
  Fix: add `@limiter.limit(...)` to both routes, matching `auth.py`'s pattern.

## Medium (P2) - worth doing
- **[fintrack-backend/app/schemas/budget.py:9,16]** `limit_amount: Money = Field(gt=0)` still has no upper ceiling, unlike `TransactionBase.amount` and `AccountCreate.opening_balance`. Fix: add `le=MAX_TRANSACTION_AMOUNT`.
- **[fintrack-backend/app/services/account_service.py:78-81]** `AccountService.create(..., currency: str, ...)` still takes a `currency` parameter and silently discards it, hardcoding `currency="INR"` in the constructor call. Fix: drop the dead parameter or make the schema reject non-INR values explicitly (422) instead of swallowing them.
- **[fintrack-backend/app/api/auth.py:187-193, 400, 412]** Confirmed: `/signup` still returns a distinct 409 message for "email exists" vs. "phone exists," enumerable, inconsistent with login/forgot-password's deliberately generic responses elsewhere in the same file. Fix: collapse to one generic "an account with this email or phone already exists" message, or explicitly accept the trade-off.
- **[fintrack-backend/app/utils/admin_auth.py:14]** `@limiter.limit("30/minute")` is applied to the shared dependency `require_admin_key` rather than per-route. The in-file comment explains this is deliberate (so a bad key is throttled before any route logic runs), but if slowapi's storage key is built from `request.scope["endpoint"]` (the actual route function FastAPI sets, not the dependency), `/api/admin/health` and `/api/admin/stats` likely each get their own independent 30/min bucket rather than sharing one — doubling the effective brute-force budget against `ADMIN_API_KEY`. Still unverified in this environment (slowapi isn't installed here); carried forward as "verify, likely fix" for a third cycle.
  Fix: add a test hitting one admin route 30 times then immediately hitting the other once, asserting 429; or key the limiter explicitly off the caller rather than the matched route.
- **[fintrack-backend/app/services/budget_service.py:59-67, 118-146]** Budget creation and period-rollover remain check-then-insert with no unique constraint on `(user_id, category, period)`, unlike `Transaction`'s partial unique indexes for the same race shape. Two concurrent requests can create duplicate active budgets.
  Fix: add a partial unique index scoped to the active window, or wrap the insert in `try/except IntegrityError`.
- **[fintrack-backend/app/schemas/insights.py:7,11,15]** Confirmed: `total: float` on `MonthlyTotal`/category/merchant breakdowns, inconsistent with the shared `Money` decimal-string type used everywhere else in the API, including the ledger fields these numbers are summed from. Low practical risk today (`parseMoneyInput`/display-only use on the frontend) but a float-precision landmine if these values are ever combined with ledger amounts.
  Fix: serialize via the `Money` type (or `str(Decimal(...))`), keeping the `SUM()` as `Decimal` through to the response.
- **[fintrack/app/(modals)/add-expense.tsx:80-84, app/(modals)/accounts.tsx:216-223]** No client-side maximum-amount check before submit (only format/positivity), unlike the backend's `MAX_TRANSACTION_AMOUNT`/`MAX_OPENING_BALANCE` ceilings. An absurd amount round-trips to a raw 422 instead of an inline message. Fix: mirror the backend constants client-side.

## Cross-repo contract issues
- **[fintrack-backend: app/schemas/insights.py:7,11,15 (`float`) <-> fintrack: src/utils/money.ts:3-9 (comment: "every amount field... travels as a decimal string")]** The frontend's own money-parsing module documents an invariant ("every API amount is a decimal string, never a float") that these three fields don't actually satisfy — they're the one place a raw JSON number crosses the wire. Nothing breaks today since the frontend treats these as display-only numbers, but it's a documented-but-violated contract. Fix: see the Medium finding above.
- **[fintrack: src/api/endpoints/transactions.ts (`amount: number` on write) <-> fintrack-backend: app/schemas/money.py (Money always serializes as a string on read)]** Confirmed still asymmetric: every response field is a decimal string, every write payload sends a raw JS `number`. Round-trips exactly today at these magnitudes (2-decimal amounts, well within float precision), but is the landmine `money.py`'s own docstring warns against. Fix: send the already-validated decimal string on writes instead of a parsed `number`.
- **Verified, no new drift found.** Endpoint inventory (`fintrack-backend/app/api/*.py` route decorators) against the frontend's `src/api/endpoints/*.ts` call sites: every route has a matching call and vice versa, methods match, field names are snake_case on both sides with no camelCase drift, and `extractErrorMessage` (`fintrack/src/api/client.ts`) correctly normalizes both the plain-string and 422-array `detail` shapes. The naive-IST timestamp convention (`fintrack-backend/app/utils/timezone.py` <-> `fintrack/src/utils/date.ts`) remains a deliberate, consistently-implemented deviation from ISO-with-offset, not a bug.

## Nits & style
- `ruff check .` on fintrack-backend: 254 findings, unchanged in character from last cycle — 81 `B008` (FastAPI's `Depends()`-in-default idiom, a known false positive), 67 `UP045` (`Optional[X]` style), 36 unsorted imports, 30 verbose `Decimal("10")` constructors, 12 `BLE001` blind-except (mostly deliberate best-effort guards in `init_db.py`/`auth.py`/`gmail.py`, already commented as intentional). 149 are auto-fixable with `ruff check --fix .`.
- `mypy`, `pytest --collect-only`, and `pip-audit` could not run: FastAPI/SQLAlchemy aren't installed in this environment and installing dependencies is out of scope for a review-only run.
- `npm run lint` / `npx tsc --noEmit` could not run meaningfully on fintrack: `node_modules` isn't installed, so every import resolves as "module not found" rather than a real type error.
- `npm audit --omit=dev`: 34 advisories (1 critical: `shell-quote` ReDoS; several high: `node-forge`, `source-map-js`, `zod`), all transitive dependencies of the Jest/Metro/EAS/Babel toolchain, not in the shipped runtime bundle. Routine `npm audit fix` pass recommended, not urgent.
- Secret scan (both repos, Stripe/AWS/Google/GitHub key patterns + PEM private-key blocks): clean. Only `fintrack-backend/.env.example` exists, placeholder values only.
- **Process note, not a code finding:** six prior weekly-review PRs (#5 2026-10-05, #6 2026-10-12, #7 2026-10-12 follow-up, #8 2026-10-19, #9 2026-10-26, #10 2026-11-02) are all still open on `Akasht3010/fintrack`. None appear to have been merged or acted on, and the codebase has had no commits since 2026-10-25 — three review cycles running against the same snapshot. Worth deciding whether to merge/triage the backlog, close the superseded ones, or pause the weekly schedule until the P0 fix lands.

## What looks good
- Money handling remains rigorous end-to-end on the ledger: `Numeric(12,2)`/`Decimal` columns, the shared `Money` Pydantic type serializing as exact strings, and a `decimal.js`-based parser/formatter on the frontend — zero hardcoded `$`/float `toFixed(2)` found anywhere.
- IDOR discipline is still consistently correct across every transaction/account/budget/category read and write — ownership is filtered at the query level, never fetch-then-check.
- Auth internals remain unusually mature for a project this size: bcrypt, `token_version`-based "log out everywhere," atomic `UPDATE ... WHERE` OTP attempt-reservation, DB-bound single-use OAuth state, and enumeration-safe login/forgot-password responses.
- Idempotency is still enforced at the database layer (partial unique indexes), not just in application code, correctly closing manual-entry and Gmail/SMS-import duplicate-insert races.

## Suggested next steps
1. Land the logout cache-clear fix (`queryClient.clear()` in `useUserStore.logout()`) — this is the one finding that has now survived three straight review cycles with a direct, currently-exploitable cross-user data leak.
2. Triage the six open weekly-review PRs (#5–#10): merge what's still valid, close what's superseded, so future reviews report deltas instead of re-confirming a growing backlog.
3. Stop persisting the `user` object through web `localStorage`; add the OAuth client-side state check; add rate limits to `/api/sms/sync` and `/api/gmail/sync`.
4. Bump `python-multipart` to `>=0.0.9`.
5. Add the budget `limit_amount` ceiling, fix the discarded `currency` parameter in `AccountService.create`, and collapse the signup 409 enumeration.
6. Once dependencies can be installed, re-run `mypy`, `pytest`, `pip-audit`, `tsc --noEmit`, and `expo lint` for real signal — none of the "could not run" tools have executed in any of the last three cycles.
