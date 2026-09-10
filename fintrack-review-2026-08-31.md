# Fintrack Weekly Code Review - 2026-08-31

## Summary

Both repos reviewed: `fintrack` (frontend) at `f97d1a235d763632cb7dc08b1a7044694b0b8834`, `fintrack-backend` at `e4a6050becb36939c834825b5bcecac5ff1ef829`. Both were available and cloned. This is a mature, actively-hardened codebase — the last three backend commits are themselves fixes from prior review cycles (auth-bypass fix, P1 security fixes, P2 fixes), and the IDOR/ownership discipline, OTP handling, CSRF-nonce OAuth state, and CSV/formula-injection guarding are all solid. The headline concern this week is a genuine account-takeover bug in the Google sign-in redirect (unvalidated `app_redirect_uri` lets an attacker exfiltrate a victim's freshly-minted JWT), alongside the DB password being printed to stdout on every boot, and the long-standing fact that every money field in the backend (`Transaction.amount`, `Account.opening_balance`, `Budget.limit_amount`/`spent_amount`) is stored and summed as IEEE-754 `float` rather than `Decimal`/`Numeric` — a systemic precision-corruption risk in a fintech app. Static analysis was limited by the environment (no `node_modules`, no Python venv installed, so only `ruff` and `npm audit` could run without installing anything) but still surfaced a directly-relevant `axios` supply-chain finding.

## Critical (P0) - fix before deploy

- **[fintrack-backend/app/api/google_auth.py:52,106-109]** Open redirect lets an attacker steal any victim's session token (account takeover)
  Why it matters: `GET /api/auth/google/authorize?app_redirect_uri=...` accepts an arbitrary, unvalidated string and binds it server-side to the OAuth nonce (closing the old CSRF hole), but nothing validates that the URI actually belongs to the app. After the victim completes real Google consent, `google_callback` mints a live JWT and redirects the browser to `f"{app_redirect_uri}{separator}token={access_token}"` — so a link like `.../authorize?app_redirect_uri=https://attacker.com/collect` sent to a victim results in their own browser handing their fresh access token straight to the attacker's server. No XSS or MITM required, just a clicked link.
  Fix:
  ```python
  ALLOWED_REDIRECT_PREFIXES = ("fintrack://", "https://fintrack.app/")  # or an app.json-driven allowlist

  def _validate_redirect(uri: str) -> str:
      if not uri.startswith(ALLOWED_REDIRECT_PREFIXES):
          raise HTTPException(status_code=400, detail="Invalid redirect target")
      return uri

  @router.get("/authorize")
  async def google_authorize(app_redirect_uri: str = Query(...)):
      app_redirect_uri = _validate_redirect(app_redirect_uri)
      ...
  ```
  Apply the same check in `google_callback` as defense-in-depth, and to the identical pattern in `app/api/gmail.py:29-44,54,64-65`.

- **[fintrack-backend/app/config/database.py:22]** Raw `DATABASE_URL`, including the live DB password, is printed to stdout on every process start
  Why it matters: `print(f"📦 Using database: {DATABASE_URL}")` logs the unredacted connection string (`postgresql://user:password@host/db`) to whatever aggregates Railway's process stdout. Compare to the safe pattern already used two files over in `app/config/init_db.py:127`, which relies on SQLAlchemy's `URL.__str__` auto-masking the password — this line bypasses that entirely.
  Fix:
  ```python
  from sqlalchemy.engine import make_url
  print(f"📦 Using database: {make_url(DATABASE_URL).render_as_string(hide_password=True)}")
  ```

- **[fintrack-backend/app/models/transaction.py:11, app/models/account.py:17, app/models/budget.py:11-12]** Money is stored and computed as `Float`, never `Decimal`, across the entire backend
  Why it matters: `Transaction.amount`, `Account.opening_balance`, `Budget.limit_amount`, `Budget.spent_amount` are all `Column(Float, ...)`, and every schema (`app/schemas/transaction.py:22`, `app/schemas/account.py:22`, `app/schemas/budget.py:7,14,19`) and aggregate (`compute_balance`/`account_service.py:16-48`, `compute_spent`/`budget_service.py:31-45`, all three grouped sums in `app/api/insights.py:50,63,81,92,103,117`) does binary-float arithmetic on it, including `float(total or 0.0)` casts after SQL `SUM`. IEEE-754 doubles cannot represent most decimal fractions exactly; over many transactions and FX conversions, computed balances will drift from what a bank statement shows, and float-equality/threshold comparisons elsewhere in the code become unreliable.
  Fix: migrate every money column to `Numeric(18, 4)` (Postgres `numeric`), use Python `Decimal` throughout the services, and switch Pydantic fields from `float` to `condecimal(...)`/`Decimal`. This is a real migration (touches 3 models, ~6 schemas, 3 services, insights) — worth its own ticket rather than a quick patch.

## High (P1) - fix this sprint

- **[fintrack-backend/app/api/gmail.py:30,34 <-> fintrack/src/hooks/useGmailConnect.ts:40]** Live bearer JWT sent as a URL query parameter when linking Gmail
  Why it matters: `GET /gmail/authorize?token=<jwt>&app_redirect_uri=...` — the frontend appends the user's real access token to a URL it then opens in a system browser / navigates to on web (`useGmailConnect.ts:40,47`). That token lands in server/proxy access logs, and on the web platform, browser history. Anyone with read access to those logs can replay the token as that user.
  Fix: have the frontend call an authenticated `POST` to mint a short-lived, single-use linking code, and pass only that code in the URL instead of the real access token.

- **[fintrack-backend/app/api/auth.py:164-200,246-268; app/services/otp_service.py]** No rate limiting anywhere in the app
  Why it matters: confirmed via `grep -rniE "slowapi|limiter|rate.?limit|throttle"` across `app/` and `requirements.txt` — zero hits. `/login`'s password check, `/forgot-password`, and `/verify-otp`'s 6-digit code have no per-IP or per-account lockout; the only friction is bcrypt cost and OTP's 5-attempt cap. A distributed attacker can brute-force passwords or grind through OTP codes across many IPs against real user accounts.
  Fix: add Redis-backed (already a dependency) per-identifier and per-IP rate limits on `/login`, `/forgot-password`, `/verify-otp`, `/resend-otp`.

- **[fintrack-backend/app/services/exchange_rate_service.py:65-70 → app/api/insights.py:63,92,117]** Blocking synchronous HTTP call inside `async def` route handlers
  Why it matters: `get_rate()` calls `httpx.get(...)` (sync client) directly from `async def get_insights`/accounts/budgets handlers. A sync network call inside an `async def` blocks FastAPI's single event-loop thread for its full duration (up to the configured timeout) — one user's cold-cache FX lookup stalls every other in-flight request on that process, a real availability problem on a shared server.
  Fix: switch to `httpx.AsyncClient` with `await`, or wrap the sync call in `await run_in_executor(...)`.

- **[fintrack/src/store/useUserStore.ts:23-28]** Logout clears secure storage but not the in-memory TanStack Query cache or the transaction store
  Why it matters: `logout()` deletes the SecureStore tokens and resets its own Zustand state, but never calls `queryClient.clear()` and never resets `src/store/useTransactionStore.ts`. On a shared/handed-off device, a second account logging in without a full app restart can render the previous user's cached accounts/budgets/insights/transactions for at least one frame — a financial-data leak between sessions on the same device.
  Fix: thread the `QueryClient` (created in `app/_layout.tsx:17`) into `useUserStore.logout()` and call `queryClient.clear()`; reset `useTransactionStore` to its initial state in the same call.

- **[fintrack-backend/app/api/auth.py:172-177,256-261]** User enumeration on `/login` and `/forgot-password`
  Why it matters: both return a distinct `404 "No account found for this phone number or email"` for a nonexistent identifier vs. a different error for a wrong password, letting an attacker enumerate which emails/phone numbers have accounts — a meaningful head start when combined with the missing rate limiting above.
  Fix: return the same generic message/status for "no such account" and "wrong password" on `/login`; consider always returning 200 with "if this account exists, a code was sent" on `/forgot-password`.

## Medium (P2) - worth doing

- **[fintrack-backend/app/api/accounts.py:19-20 → app/services/account_service.py:16-48,110-139; app/api/budgets.py:39-40 → app/services/budget_service.py:31-45]** N+1 queries on accounts and budgets listing (2N and N extra DB round-trips respectively); `insights.py` already does this correctly with grouped queries — apply the same pattern.
- **[fintrack-backend/app/utils/oauth_state.py:8]** OAuth state nonces live in a process-local `dict`; a Railway restart or scaling past one instance loses in-flight state and breaks legitimate sign-in attempts. Move to Redis (already a dependency) with the same TTL.
- **[fintrack-backend/app/services/budget_service.py:54-61 vs app/models/transaction.py:31-37]** Budget overlap is only check-then-insert in application code, with no DB-level constraint backing it (unlike the transaction-dedup unique index). Two concurrent `POST /api/budgets` for the same category/period can both pass and create duplicate live budgets.
- **[fintrack-backend/app/schemas/budget.py:7,14]** `limit_amount` has no upper ceiling (`le=`), unlike `TransactionCreate.amount` and `AccountCreate.opening_balance`, which both have one.
- **[fintrack-backend/app/schemas/sms.py:11-12, app/api/sms.py:35-93]** SMS sync batch is unbounded (no `max_length` on the message list or per-message body), and each message costs 2-3 DB queries + a commit — a large/malicious payload drives disproportionate DB load.
- **[fintrack/app/(modals)/add-expense.tsx:72-81,122-123]** No validation that `parseFloat(amount)` is finite/positive/bounded before submit. `keyboardType="decimal-pad"` is a hint, not a filter (paste can still inject `"abc"`), and `JSON.stringify(NaN)` serializes to `null`, so a malformed input can silently submit `amount: null`. `add-budget.tsx:43-47` already does this correctly (`isNaN`/`<= 0` guard) — mirror it here.
- **[fintrack/app/(modals)/add-expense.tsx:72; add-budget.tsx:42]** No synchronous re-entrancy guard (`if (isPending) return`) at the top of `handleSubmit`; the only double-submit protection is `disabled={isPending}` on the button, which only takes effect after a React re-render — a fast double-tap can fire two money-creating requests with no idempotency key for the backend to dedupe on.
- **[fintrack/app/(tabs)/index.tsx:87-104]** Dashboard "This month" total sums `t.amount` across all transactions regardless of currency (defaults display to INR), and is derived from a store capped at the first 50 transactions fetched — under-reports spending with no indication it's partial. `app/(tabs)/transactions.tsx:96-105` already has the correct single-currency guard for the same problem; apply it here too, and source the total from a real aggregate rather than a capped page.
- **[fintrack/app/(modals)/add-budget.tsx:156]** Hardcoded `₹` symbol ignores the app's multi-currency support (`add-expense.tsx:207` correctly derives the symbol via `currencySymbol(currency)`).
- **[fintrack/src/utils/storage.ts:8-24 + wrangler.jsonc + package.json `"deploy"` script]** The web-platform token fallback (`localStorage`, unencrypted) is commented as "fine for browser-based testing," but the repo has a real `expo export -p web && wrangler deploy` pipeline that ships the web build to production Cloudflare — meaning this isn't test-only, it's a real production surface storing JWTs in plain `localStorage` (XSS-exposed). Either explicitly gate auth off the deployed web target, or accept and document the risk with mitigations (short token TTL already helps; add a CSP).
- **[fintrack-backend/requirements.txt — no lockfile / unpinned ranges; fintrack/package-lock.json → axios@1.15.1]** `axios` is a direct runtime dependency at 1.15.1 with multiple high-severity advisories from `npm audit` (prototype-pollution/credential-injection gadgets in config-merge and the HTTP adapter, Proxy-Authorization leak across redirects, ReDoS via cookie-name injection). This is the one `npm audit` finding that's actually in the shipped app bundle (as opposed to the ~30 other flagged packages, which are Metro/Expo-CLI/PostCSS build tooling never bundled into the app). Bump to the latest 1.x patch.

## Cross-repo contract issues

- **[fintrack-backend/app/api/transactions.py:233-265 (returns `{"detail": "..."}`) <-> fintrack/app/(modals)/add-expense.tsx:100-101]** The update-transaction error handler shows a generic `"Failed to update transaction"` instead of reading `error.response.data.detail` — every other error path in the app (login.tsx:88, signup.tsx:101, verify-otp.tsx:63/84, add-expense.tsx:149 for *create*) does this correctly, so backend messages like "Transaction currency 'USD' doesn't match account…currency 'INR'" are silently swallowed on edit. Fix: read `.detail` here too, matching the sibling create-path handler.
- **[fintrack-backend/app/services/recurring_service.py (naive-IST `next_due_date`) <-> fintrack/app/(modals)/recurring.tsx:63]** `isOverdue` is computed as `dayjs(item.next_due_date).isBefore(dayjs())` — parsed in device-local time, not IST — while the adjacent `formatDate`/`formatRelative` calls in the same file correctly go through `toIST()`/`nowIST()` (`src/utils/date.ts:22-23,34-35`). On any device not set to IST, the red "overdue" styling can disagree with the correctly-IST-aware "Due"/"Next" text right next to it. Fix: route `isOverdue` through the same IST-aware helper.
- **[fintrack/src/types/api.d.ts:1-24 <-> nowhere in fintrack-backend]** `ApiResponse<T>`, `PaginatedResponse<T>` (`{data,total,page,limit,hasMore}`), `AuthTokens` (camelCase `accessToken`/`refreshToken`/`expiresIn`), and `GoogleAuthPayload` (`{code,redirectUri}`) describe a REST contract that doesn't exist anywhere in the backend (FastAPI never wraps responses that way; there's no refresh-token concept; Google auth is a server-mediated redirect, not a POST). Confirmed dead — zero usages outside the file itself. Not currently breaking anything, but actively misleading to anyone reading it as ground truth. Fix: delete it, or mark it clearly as aspirational/unused.
- **[fintrack-backend/app/api/transactions.py:170-213 (accepts `q`, `min_amount`, `max_amount`) <-> fintrack/src/api/endpoints/transactions.ts:46-54 + app/(modals)/export.tsx:66-72]** `GET /api/transactions/export` supports search/amount filters that the export screen never sends — users can filter the transaction list by amount/search but can't export exactly what they're looking at. One-sided feature gap, not a bug.

## Nits & style

- `app/api/gmail.py:60` — exception text (`str(e)`) is injected into a redirect URL unescaped/unbounded; URL-encode it and avoid leaking internal error detail to the client.
- `app/services/account_service.py:90-95` — account delete checks for referencing transactions then deletes without a lock (TOCTOU); a concurrent insert in between raises an unhandled `IntegrityError` (500) instead of the intended 409. `transactions.py:125-136` already shows the right pattern (catch `IntegrityError`) — reuse it.
- `app/utils/timezone.py:12-15`'s comment says OTP expiry uses UTC; `otp_service.py:51,61,84` actually uses `now_ist()` throughout. Self-consistent today, but stale/misleading and invites a future mixed-convention bug.
- `app/services/gmail_service.py:106,123` — bare `print()` instead of `logging` on error paths.
- `app/api/sms.py:37` — `datetime.fromtimestamp(message.date/1000, ...)` isn't wrapped in try/except (unlike the equivalent Gmail date parsing, which falls back to `now_ist()`); a malformed `date` 500s the request.
- `app/services/email_parser.py:147` — only lower-bounds parsed amounts (`> 0`); no upper sanity check, so a garbled parse could fabricate an implausibly large transaction.
- `app/api/transactions.py:60-61,148-149,176-177` — `min_amount`/`max_amount` filters have no bound and no `min <= max` check. Low risk (read-only, self-scoped).
- `src/config/env.ts:8` — defaults `API_URL` to `http://localhost:8000`; unreachable in practice since `app.json`'s `extra.apiUrl` is always set, but a misconfigured build would silently try plain HTTP instead of failing loudly. Prefer throwing if `extra.apiUrl` is missing.
- `src/api/client.ts:39` — 403 is treated the same as session-expiry app-wide based on today's one usage (missing auth header); documented, but fragile if a future legitimate 403 (e.g. resource-level authorization) is added.
- `app/(modals)/accounts.tsx:53,180` — `parseFloat(openingBalance) || 0` silently coerces invalid input to `0` instead of surfacing an error; same fix pattern as the add-expense finding above.
- `modules/sms-reader/src/SmsReaderModule.kt:47` — sort clause built via raw string interpolation (`"... LIMIT $limit"`); `limit` is type-coerced to `Int` by the Expo modules bridge so not currently exploitable, but bind it as a query arg rather than relying on that as the only safety net.
- `app/(tabs)/index.tsx:63-68` — `queryFn` mutates the Zustand store as a side effect instead of deriving state from the query result, and no `AbortSignal` is ever forwarded to axios anywhere in the app, so in-flight requests aren't actually cancelled on unmount/refetch.
- `authApi.refreshToken()` (`src/api/endpoints/auth.ts:144-147`) is fully implemented and contract-correct against `POST /api/auth/refresh`, but never called — every 401/403 forces a full re-login (password + OTP) every 30 minutes instead of a silent refresh. Either wire it into the `client.ts` interceptor or remove it to avoid the confusion of dead code.
- `app/services/recurring_service.py:83`, `app/api/recurring.py:36` — `round(..., 2)` on float aggregates is a cosmetic patch over the Float-vs-Decimal P0; becomes unnecessary once amounts are `Decimal`.

## What looks good

- **IDOR discipline is consistently correct across the whole backend.** Every by-ID GET/PATCH/DELETE in transactions, accounts, budgets, categories, and recurring filters by `user_id == current_user.id` (or the equivalent ownership helper) with no exceptions found — the single most important class of bug in a personal-finance app, and it's handled right everywhere.
- **OTP handling is genuinely solid**: codes are SHA-256-hashed at rest, compared with `hmac.compare_digest`, single-use, capped at 5 attempts, server-side expiry and resend cooldown, and the console-fallback for missing SMTP now requires `ENV=development` explicitly rather than silently leaking codes in a misconfigured production deploy.
- **Cross-currency aggregation is done right**: every aggregate (insights, budgets, account balances) groups by currency and converts in Python rather than a naive SQL `SUM` across mixed currencies, with FX lookups that fail safe (last-known-good rate, never a blind 1.0, never cache a failure).
- **Frontend money display is consistent and correct**: `src/utils/currency.ts`'s `Intl.NumberFormat`-based formatter is used everywhere money is rendered, with no stray `.toFixed(2)` float-rounding or hardcoded `$` signs found in the screens reviewed, and native token storage correctly uses `expo-secure-store` rather than plain `AsyncStorage`.

## Suggested next steps

1. Fix the `app_redirect_uri` open redirect (google_auth.py + gmail.py) and the `DATABASE_URL` stdout leak — both are small, self-contained patches and the highest-severity items this week.
2. Scope and schedule the Float→Decimal money migration as its own piece of work (models, schemas, services, insights) rather than folding it into an unrelated PR.
3. Add rate limiting on `/login`, `/forgot-password`, `/verify-otp`, `/resend-otp` using the existing Redis dependency.
4. Stop sending bearer tokens as URL query params for Gmail linking; swap in a short-lived linking code.
5. Wire `queryClient.clear()` + transaction-store reset into frontend logout, and add the amount-validation/re-entrancy guards to `add-expense.tsx`.
6. Batch the remaining P2/nit items (N+1 queries, budget race, SMS batch cap, `axios` bump, dead `refreshToken`/`api.d.ts` cleanup) into a routine hardening PR.
