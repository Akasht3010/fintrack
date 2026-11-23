# Fintrack Weekly Code Review - 2026-11-23

## Summary
Both repos are in good shape overall: the money layer takes `Decimal`/string-on-the-wire seriously and has real tests for it, IDOR checks on account/budget/transaction routes are comprehensive and test-covered, and the auth/session design (OTP reservation, cookie CSRF defense-in-depth, refresh-race dedup, timing-safe login) is unusually mature for a project this size. The headline concerns are smaller and more "sharp edge" than "open hole": per-IP-only throttling has no account-level ceiling against a distributed brute force, a few exception paths still `print()` raw exception text instead of using the redaction-aware logger, logout doesn't clear the React Query cache (a real cross-account data-leak risk on a shared device), and the Insights/Recurring aggregates quietly violate the app's own Decimal-string money convention by serializing as float on both sides. No committed secrets or `.env` files were found in either repo. Backend reviewed at `fintrack-backend@0dd0ce4` (branch `main`), frontend at `fintrack@8a37d4c` (branch `main`). Both repositories were available and reviewed in full.

**Tooling note:** neither repo's dependencies are installed in this review environment (no `node_modules` in fintrack, no `fastapi`/`sqlalchemy`/etc. in fintrack-backend), and the task scope disallows installing packages. `ruff` (pre-installed) ran directly against the backend and its output is folded in below. `npm audit` ran off the lockfile without needing `node_modules` and is folded in below. `mypy`, `pytest --collect-only`, `pip-audit`, `expo lint`, and `tsc --noEmit` could not produce meaningful results (missing interpreter deps) and are not treated as ground truth here — the `tsc` output in particular is ~100 lines of "cannot find module" noise from the missing `node_modules`, not real type errors, and has been discarded rather than reported as findings.

## Critical (P0) - fix before deploy
None found.

## High (P1) - fix this sprint

- **[fintrack/src/store/useUserStore.ts:25-43]** Logout never clears the React Query cache — stale balances/transactions can leak across accounts on a shared device
  Why it matters: `logout()` clears the stored token and the `user` key but never calls `queryClient.clear()`/`removeQueries()`. The app's single `QueryClient` (`app/_layout.tsx:26-33`) has a 5-minute `staleTime` and lives for the app's whole lifetime. If User A logs out and User B logs in on the same device within that window, screens reading cached transaction/account/budget/insights query keys can render User A's financial data before the background refetch resolves. This is a real cross-account PII/money data leak, not a cosmetic bug.
  Fix:
  ```ts
  // useUserStore.ts
  import { queryClient } from "@/api/queryClient" // or wherever the singleton lives
  logout: () => {
    clearStoredSession()
    queryClient.clear()
    set({ user: null, isAuthenticated: false })
  }
  ```
  Add a regression test on `useUserStore.logout()` asserting the cache is cleared.

- **[fintrack-backend/app/api/gmail.py:111]** Raw exception text printed to logs on disconnect, contradicting this file's own stated rule
  Why it matters: Lines 82-89 and 144-151 of this exact file deliberately avoid `str(e)` for OAuth/HTTP client exceptions because "they can carry response bodies or internal hostnames." Line 111 does exactly that (`print(f"...{e}")`), and uses `print()` instead of `logger`, bypassing whatever redaction/log-level config the rest of the app relies on. In a fintech app, "internal hostnames or response bodies in logs" is exactly the kind of leak this review is watching for.
  Fix:
  ```python
  except Exception:
      logger.exception("Gmail token revoke failed on disconnect for user_id=%s", current_user.id)
  ```

## Medium (P2) - worth doing

- **[fintrack-backend/app/utils/rate_limit.py:37, app/api/auth.py:208,250,299,338]** Login/OTP/reset throttling is keyed only on source IP, with no account-level ceiling
  Why it matters: `/login`, `/verify-otp`, `/forgot-password`, `/reset-password` are all `@limiter.limit("10/minute")` keyed on `client_ip(request)` alone. An attacker rotating IPs (botnet/residential proxies) gets 10 fresh password/OTP guesses per minute *per IP* against one specific victim, with no aggregate cap tied to the account itself. OTP brute force is separately bounded per-code (`MAX_OTP_ATTEMPTS=5` in `otp_service.py`), but raw password guessing on `/login` has no such backstop.
  Fix: add a second limiter bucket keyed on the normalized identifier (email/phone) for `/login` and `/forgot-password`, independent of IP — e.g. a small per-identifier attempt counter table, or a slowapi key function reading `request.state.parsed_body.identifier`.

- **[fintrack-backend/app/api/auth.py:185-193, app/services/user_service.py:45-66]** Concurrent signup with the same email/phone can 500 instead of 409
  Why it matters: `create_user` does an app-level SELECT-then-INSERT duplicate check; the DB's unique constraints correctly stop a true race, but the resulting `IntegrityError` is never caught at this call site, so it surfaces as an unhandled 500 instead of the normal `DuplicateUserError` → 409 path every other duplicate gets. `tests/test_auth.py` proves the DB constraint exists but never drives the race through the HTTP endpoint.
  Fix: wrap the commit in `try/except IntegrityError`, roll back, and raise `DuplicateUserError` — mirroring the pattern already used for the email-change race at `app/api/auth.py:477-481`.

- **[fintrack-backend/app/services/gmail_service.py:41-48]** `revoke_token` never checks the HTTP response status
  Why it matters: `httpx.post(...)` to Google's revoke endpoint has no `raise_for_status()`. Google returns 4xx (not a transport error) for an already-invalid token, so a real revoke failure is silently treated as success and never reaches the warning path `gmail.py` was written to catch.
  Fix: `resp = httpx.post(...); resp.raise_for_status()` inside the existing try/except.

- **[fintrack-backend/app/services/gmail_service.py:106,123]** `print(f'Error ...: {e}')` on Gmail message parse failures
  Why it matters: same str(exception)-exposure concern as the P1 above (`googleapiclient.HttpError` can embed response bodies), plus silent `print()` means a systematically failing parse never surfaces in logs/alerts.
  Fix: `logger.warning("Gmail message %s unparseable: %s", message_id, type(e).__name__)` — log the exception type, not its text.

- **[fintrack-backend/app/api/gmail.py, app/api/sms.py — POST /sync routes]** No rate limit on Gmail/SMS sync endpoints
  Why it matters: each call can trigger up to 50 Gmail fetches or 500 SMS parses + DB writes. Blast radius is self-scoped (a user can only burn their own quota/DB load), so not critical, but a buggy client retry loop or a stolen token could still hammer Gmail API quota or the DB.
  Fix: add a per-user `@limiter.limit(...)` to both sync routes.

- **[fintrack-backend/app/schemas/insights.py:7,13,16, app/schemas/recurring.py:8,17 ↔ fintrack/src/types/domain.ts MonthlyTotal/CategoryBreakdownItem/MerchantBreakdownItem/RecurringItem/RecurringSummary]** Insights/Recurring money aggregates break the app's own Decimal-string convention — see Cross-repo contract issues below.

- **[fintrack-backend/app/api/recurring.py:19, app/services/recurring_service.py:36-45]** `detect_recurring` scans a user's entire transaction history on every request
  Why it matters: no date filter, even though the longest cadence window (yearly, ±25 days) only needs ~13 months of data. For a long-lived account this is an ever-growing, uncached query on a page users visit often.
  Fix: `Transaction.date >= now - timedelta(days=400)` in the query at `recurring_service.py:36`.

- **[fintrack/src/hooks/useGoogleAuth.ts:78, app/auth-callback.tsx:41, src/hooks/useGmailConnect.ts:73, app/gmail-callback.tsx:37, app/(auth)/reset-password.tsx:76, app/(auth)/verify-otp.tsx:62]** Full user profile (name/email/phone) persisted in plaintext on web
  Why it matters: all write `JSON.stringify(user)` to `SecureStore.setItemAsync("user", ...)`, which on web is plain `localStorage` — readable by any script on the page (XSS, malicious extension). Lower severity than a token leak, but it's PII sitting in the exact storage the backend's HttpOnly-cookie migration was explicitly trying to get away from.
  Fix: don't persist the full user object on web; refetch via `authApi.getMe()` on app start (the HttpOnly cookie already authenticates it), or persist only non-sensitive display fields.

- **[fintrack/src/api/endpoints/transactions.ts:5, src/api/endpoints/budgets.ts:5-8, src/api/endpoints/accounts.ts:16]** Outbound money payloads typed as JS `number`, not the decimal string the codebase's own convention calls for
  Why it matters: `TransactionCreatePayload.amount`, budget `limit_amount`, account `opening_balance` are all `number`. Currently harmless (`parseMoneyInput` regex-validates ≤2 decimals before `Number()`, and these magnitudes round-trip exactly through a JSON number), but it's a landmine: any future feature that does arithmetic on the parsed value before sending (e.g. splitting an expense) would silently reintroduce float drift on the way out, with nothing in the type system to stop it.
  Fix: have `parseMoneyInput` return the validated string (or a `Decimal`), and change these payload types to `string`.

- **[fintrack/app/(modals)/accounts.tsx:200-223]** Account creation has no idempotency/dedup guard
  Why it matters: `budgetApi.create`/transaction create both have server-side idempotency-key handling; account creation doesn't. A network-level retry (client times out but the first request actually succeeded) can create two identical accounts. Client-side double-tap is covered by `isCreating`, but not a true retry.
  Fix: give account creation the same idempotency-key treatment transactions already use (`src/utils/idempotencyKey.ts`).

- **[fintrack-backend — ruff]** 254 ruff findings, overwhelmingly style (unsorted imports, verbose `Decimal("10")` → `Decimal(10)`, a few `RUF059` unused-unpacked-variables in tests). One worth a second look: `tests/test_sms_sync.py:3` constructs `datetime(2026, 9, 5, 12, 0, 0)` tz-naive (`DTZ001`) as a test fixture base time — harmless in a test file given the app's own naive-IST convention, but flagged since it touches date/time logic. 149 of the 254 are auto-fixable with `ruff check --fix`.

## Cross-repo contract issues

- **[fintrack-backend/app/schemas/insights.py:7,13,16 + app/schemas/recurring.py:8,17 <-> fintrack/src/types/domain.ts MonthlyTotal.total, CategoryBreakdownItem.total, MerchantBreakdownItem.total, RecurringItem.average_amount, RecurringSummary.monthly_total]** — Both sides agree on `float` for these money aggregates, which is internally consistent (no 422/parse failure) but is a real contract smell: every other money field in this API (`Money` type, `Decimal`, serialized as a JSON string per `app/schemas/money.py`'s own documented rationale) exists specifically to stop "a JSON number is a float on every consumer... quietly handing every client a lossy value." `app/api/insights.py:59,87,109` does `float(r.total or 0.0)` on a `Decimal` SQL `SUM()`, and `app/api/recurring.py` does `round(monthly_total, 2)` — binary rounding, not decimal — so a large aggregate can render as `1234.5600000000002` on exactly the Insights screen users stare at. Fix: change these five fields to the shared `Money` type on the backend and to `string` (parsed via `toDecimal`) on the frontend, matching every other money field in the contract — a coordinated change across both repos, which is why it's listed here rather than under either repo's own section.

- **[fintrack-backend/app/api/transactions.py:137-148 (list_transactions) <-> fintrack/src/api/endpoints/transactions.ts TransactionListFilters]** — Checked for drift, found none: both deliberately exclude `source`/`type` from the paginated list endpoint while the `/export` endpoint and `TransactionExportFilters` both include them. Noting this because it initially looked like an omission but is actually a consistent, intentional design on both sides.

- **[fintrack-backend/app/utils/timezone.py <-> fintrack/src/utils/date.ts]** — Both sides use a deliberate, well-documented "naive IST wall-clock, no UTC offset" convention instead of ISO-8601-with-offset, and both implement it consistently (backend writes naive IST via `now_ist()`/`to_ist_naive()`; frontend parses with `dayjs.tz(date, "Asia/Kolkata")` rather than trusting device-local parsing). Not a bug, but worth a standing note: any future consumer of these timestamps (a new export format, an admin tool, a BI pipeline) that doesn't go through one of these two helpers will silently misinterpret the values as UTC.

No other drift found: endpoint inventories (11 routers, ~37 routes) were diffed field-by-field against the frontend's `src/api/endpoints/*.ts` calls — every JSON-calling frontend call matches an existing backend route and method, snake_case field names match exactly on both sides (no camelCase/serialization-layer mismatch anywhere), pagination params (`page`/`limit`) match, the `detail`-string-or-array error envelope is read consistently by `extractErrorMessage` in `client.ts` and the 429 handler in `main.py` was specifically patched to match it, and CORS is an explicit env-driven allowlist (not `*`) on both the backend's own admission and the frontend's `withCredentials` usage. `authorize`/`callback` GET routes (`/api/auth/google/*`, `/api/gmail/*`) are intentionally never called via `apiClient` — they're opened via `WebBrowser.openAuthSessionAsync`/`window.location.href`, which is correct for that OAuth redirect flow.

## Nits & style
- `fintrack-backend/app/services/account_service.py:78` — `create(..., currency: str, ...)` parameter is accepted but ignored (hardcoded to `"INR"` at line 81); enforcement is correct, just drop the dead parameter.
- `fintrack-backend/app/services/budget_service.py:163` — `get_budget` is type-hinted `-> Budget` but returns `None` when not found; should be `Budget | None`.
- `fintrack-backend/sql/readable_views.sql:27,43,56` — debug views join raw `user_email` into every transaction/account/budget row; fine as a local pgAdmin script, but add a comment that these must never be granted to a reporting/analytics role or read replica.
- `fintrack-backend` — logging channel is inconsistent across the Gmail/SMS surface (`logger.exception` in `api/gmail.py` vs. bare `print()` in a few spots, see P1/P2 above) — standardize on the logger repo-wide.
- `fintrack/src/store/useTransactionStore.ts` — dead code, zero importers anywhere in the repo; duplicates state react-query already owns. Not a bug today, but an attractive nuisance for a future contributor to start writing transaction data into. Delete it.
- `fintrack/src/api/endpoints/gmail.ts:14-17` — `linkToken()` is the one GET endpoint that doesn't forward `AbortSignal`, breaking the otherwise-consistent "forward React Query's AbortSignal into every GET" invariant. Low impact, but add it for consistency.
- `fintrack/app/(auth)/login.tsx:25-32` — `clearOldTokens` swallows failures with only a `console.log`; harmless today (best-effort legacy-key cleanup) but add real telemetry if `SecureStore` ever throws for a non-benign reason.
- `npm audit` (frontend, off the lockfile): 27 vulnerabilities (1 critical: `shell-quote`; 13 high: `node-forge`, `zod`, `source-map-js`, others). All of the flagged packages (`@expo/cli`, `postcss-selector-parser`, `xcode`, `node-forge`, `shell-quote`, `zod`, `source-map-js`, `uuid`, `minimatch`) are transitive dependencies of Expo's build/CLI tooling — none are direct runtime `dependencies` of the app (confirmed against `package.json`). Worth a periodic `npm audit fix` pass, but not an exploitable path from the shipped app itself.

## What looks good
- **IDOR posture on money endpoints is the strongest seen in a review of this size.** Every account/budget/transaction read and write filters by `current_user.id` at the query level, and each one has a dedicated negative test (`test_cannot_read_another_users_account`, `test_cannot_update_another_users_account`, `test_budgets_are_scoped_to_the_authenticated_user`, `test_create_transaction_rejects_account_owned_by_someone_else`, etc.).
- **Money correctness is a first-class, tested concern.** `NUMERIC(12,2)` columns, a shared `Money` Pydantic type with matching `max_digits`/`decimal_places`, explicit Decimal-as-JSON-string serialization, and `tests/test_money_precision.py` directly asserting no float drift across many transactions. The frontend mirrors this with `decimal.js` for all arithmetic and dedicated `currency.test.ts`/`money.test.ts` coverage of exactly the inputs `parseFloat` gets wrong.
- **Auth is unusually mature for a project this size**: OTP attempt-reservation and consumption are done as single conditional `UPDATE ... WHERE` statements (no read-then-write TOCTOU race), code comparison uses `hmac.compare_digest`, login is timing-equalized against a dummy hash so "unknown account" and "wrong password" are indistinguishable, and the cookie-session web path has real CSRF defense-in-depth (`SameSite=Strict` + a custom header that forces a CORS preflight).
- **CSV export is hardened against formula injection** (`_csv_safe` in `transactions.py`, tested) — a control a lot of fintech CSV exports miss entirely.
- **Cross-repo contract hygiene is otherwise excellent** — consistent snake_case naming, matching pagination/filter params, a shared and deliberately-chosen error envelope, and an explicit CORS allowlist on both sides.

## Suggested next steps
1. Fix the two P1s first: clear the React Query cache on logout (cross-account data leak), and stop printing raw exception text in `gmail.py`'s disconnect handler.
2. Add an account-level (not just per-IP) throttle to `/login` and `/forgot-password`.
3. Align Insights/Recurring money fields to the app's Decimal-string convention on both repos in one coordinated change, with a regression test asserting the wire format.
4. Sweep the remaining P2s (signup race → 409, Gmail revoke status check, Gmail/SMS sync rate limits, recurring-detection date bound, web-storage PII, account-create idempotency).
5. Run `ruff check --fix` on fintrack-backend for the 149 auto-fixable style findings, then review the remaining ~105 by hand.
6. Install dependencies in a future review environment (or point this review at a CI run's `npm audit`/`mypy`/`pytest --collect-only` output) so lint/typecheck/test-collection can run as ground truth instead of being skipped.
