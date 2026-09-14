# Fintrack Weekly Code Review - 2026-09-14

## Summary
Repos reviewed: `fintrack` @ `711d3b5dfcd6f20389e5d4c93326f0a83aaf9b79`, `fintrack-backend` @ `d389a6c962d073e6b3f96a757e3e39e3de42b718`. Both were available and fully reviewed. This is the third consecutive weekly review, and the headline concern is that the two most severe items from last week's report (2026-09-07) — the OAuth `app_redirect_uri` open redirect that leaks a live access token, and the Gmail-connect flow passing that same token in a URL query string — are **still present and unfixed**, alongside the long-standing `Float`-for-money schema. This week's pass also surfaces two new critical issues: a profile-email-change endpoint with no password confirmation that, combined with the existing forgot-password flow, gives anyone holding a stolen access token a path to permanently take over the account; and a frontend config fallback that would silently point a production build at plaintext `http://localhost:8000` if an env var is ever missing. On the money side, a real correctness bug was found in SMS-imported transactions (never attributed to an account, so they're invisible to balance/net-worth). Static tooling was limited by the sandboxed environment: `ruff check .` passed clean on the backend (no config for `mypy`); `pytest`, `pip-audit`, `npm run lint`/`audit`, and `tsc --noEmit` could not run because neither repo's dependencies are installed here and we were instructed not to install anything — see Nits. No secrets, keys, or committed `.env` files were found in either repo's working tree.

## Critical (P0) - fix before deploy

- **[fintrack-backend/app/api/google_auth.py:52,63,85,108-109]** OAuth login redirect is an open redirect that leaks a live JWT — unfixed since last week's review
  Why it matters: `google_authorize` accepts `app_redirect_uri` as a client-supplied query parameter with no scheme/host allowlist. It's bound into the CSRF `state` nonce correctly (`create_state`, line 63), but the *value itself* is never validated. After a victim completes real Google consent, `google_callback` does `RedirectResponse(f"{app_redirect_uri}{separator}token={access_token}")` (line 109) — a phishing link such as `.../api/auth/google/authorize?app_redirect_uri=https://evil.example/collect` hands the attacker a live bearer token for the victim's account the moment they finish a real Google login. This was flagged as the top P0 in the 2026-09-07 review and no fix has landed.
  Fix:
  ```python
  ALLOWED_REDIRECT_PREFIXES = ("fintrack://", "exp://", "https://<deployed-web-origin>/")

  def _validate_redirect(uri: str) -> str:
      if not uri.startswith(ALLOWED_REDIRECT_PREFIXES):
          raise HTTPException(400, "Invalid app_redirect_uri")
      return uri
  ```
  Call `_validate_redirect` in `google_authorize` (and `gmail_authorize`, same bug) before `create_state`, and again in each `/callback` right after `consume_state`.

- **[fintrack-backend/app/api/gmail.py:32-67 <-> fintrack/src/hooks/useGmailConnect.ts:48]** Live access token is sent as a URL query parameter through a browser OAuth round-trip — unfixed since last week's review
  Why it matters: `gmail_authorize` takes `token: str = Query(...)` (the user's real bearer JWT) and `useGmailConnect.ts` builds `.../api/gmail/authorize?token=<jwt>&app_redirect_uri=...` and opens it via `WebBrowser.openAuthSessionAsync`. Unlike every other authenticated call in the app (which correctly uses the `Authorization` header, e.g. `src/api/client.ts:15-21`), this URL — and the live token inside it — passes through server access logs, reverse-proxy logs, Google's own redirect hops, and can land in browser/OS history. Flagged as P1 last week; still present verbatim, and raising to P0 this week given it's a full end-to-end credential leak, not just a theoretical one.
  Fix: have the backend mint a short-lived, single-use opaque linking nonce via an authenticated POST (using the normal `Authorization` header), and pass only that nonce — never the real access token — in the `authorize` URL.

- **[fintrack-backend/app/api/auth.py:308-334 (update_current_user) <-> app/api/auth.py:247-273 (forgot_password)]** Access token alone is enough to change the account's email, opening a full account-takeover path via forgot-password
  Why it matters: `PATCH /api/auth/me` lets any holder of a valid access token change `current_user.email` with no current-password confirmation and no verification of the new address. `forgot_password` looks the account up by whatever email is *currently* stored. So a token grabbed via XSS, a shared/lost device, or a brief window of access lets an attacker repoint the account's email to one they control, then run the normal OTP-based forgot-password → reset-password flow to lock the real owner out permanently — with no notification sent to the original address.
  Fix:
  ```python
  if payload.email and payload.email != current_user.email:
      if not payload.current_password or not verify_password(payload.current_password, current_user.password_hash):
          raise HTTPException(status_code=401, detail="Current password required to change email")
      # send a confirmation link to payload.email and keep current_user.email
      # authoritative until it's clicked, and email the OLD address an alert
  ```

- **[fintrack/src/config/env.ts:10]** Silent fallback to plaintext `http://localhost:8000` if `EXPO_PUBLIC_API_URL` is unset in any build
  Why it matters: `API_URL: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "http://localhost:8000"` means a misconfigured EAS preview/production build profile (forgotten secret, typo'd env var name) doesn't fail the build — it ships silently pointed at plaintext `localhost`, and there's no runtime assertion anywhere that a non-development build's API URL is `https://`. A real device with that build would send login credentials and the JWT in cleartext to whatever answers on `localhost:8000` for that device.
  Fix:
  ```ts
  if (ENV.APP_ENV !== "development" && !ENV.API_URL.startsWith("https://")) {
    throw new Error(`Insecure API_URL in ${ENV.APP_ENV}: ${ENV.API_URL}`)
  }
  ```

## High (P1) - fix this sprint

- **[fintrack-backend/app/api/auth.py:164-200 (login), 247-273 (forgot_password)]** No rate limiting on login or password-reset request, plus a user-enumeration oracle — unfixed since last week
  Why it matters: `verify_password` has no per-IP/per-identifier throttle or lockout, so passwords can be brute-forced at whatever rate the server allows. `/login` also returns a distinguishable `404` for an unknown identifier vs `401` for a wrong password, and `/forgot-password` has the same tell — an attacker can enumerate every registered email/phone before spending effort on guessing. `requirements.txt` has no rate-limiting library and `app/main.py` only adds `CORSMiddleware`.
  Fix: add a limiter keyed on identifier+IP (e.g. `slowapi`, or a `failed_login_count`/`locked_until` column on `User` checked before `verify_password`); return a uniform `401 "Invalid credentials"` on login and always `200 "If that account exists, a code was sent"` on forgot-password.

- **[fintrack-backend/app/api/auth.py:361-365 (refresh_token); app/models/user.py]** No server-side session revocation — a stolen token survives a password reset
  Why it matters: `/api/auth/refresh` reissues a JWT from any currently-valid one with no additional check, and there's no logout endpoint or token-version claim. A token issued before `reset_password` sets a new password hash keeps working until its own natural expiry — a user resetting their password because they suspect compromise does not actually invalidate the attacker's existing session.
  Fix: add `token_version` (or `password_changed_at`) to `User`, embed it as a JWT claim, check it in `verify_token`/`get_current_user`, and bump it in `reset_password` and on a new logout-all-devices endpoint.

- **[fintrack-backend/app/api/sms.py:79-91 <-> app/services/account_service.py:13-17]** SMS-imported transactions are never linked to an account, so they're invisible to balance and net-worth
  Why it matters: the `Transaction(...)` built in `sync_sms_messages` never sets `account_id` (`SmsMessage`/`SmsSyncRequest` has no such field), while `compute_balance` filters strictly on `Transaction.account_id == account.id`. Every SMS-synced rupee counts toward budgets/insights (keyed on `user_id`/`category`) but is silently excluded from `GET /api/accounts` and `/api/accounts/net-worth` — the app's core "how much money do I have" answer is wrong for anyone using SMS sync.
  Fix: require/accept an `account_id` on `SmsMessage` (or fall back to a per-user default account) and set it when constructing the `Transaction`; short of that, surface an explicit "unassigned funds" total rather than dropping them.

- **[fintrack-backend/app/models/transaction.py:11, app/models/budget.py:11-16, app/models/account.py:17]** Money columns are `Float`, not `Numeric`/`Decimal` — unfixed since last week
  Why it matters: `amount`, `limit_amount`, `spent_amount`, the `Computed` `remaining_amount`, and `opening_balance` are IEEE-754 doubles. `SUM()` aggregation across many rows (insights, balance, spent totals) can drift from the exact paisa value, which is not acceptable for a ledger even if no drift has surfaced in practice yet.
  Fix: migrate to `Numeric(14, 2)` and switch service-layer arithmetic to Python `Decimal` with an explicit rounding mode; scope as its own migration, not a quick patch.

- **[fintrack-backend/app/api/sms.py:67-75]** SMS duplicate-detection ignores transaction type and merchant, silently dropping legitimate transactions
  Why it matters: `duplicate_nearby` matches on `user_id` + exact `amount` + a ±10-minute window only, with no `type`/`merchant` filter. A ₹500 refund arriving 15 minutes after a genuine ₹500 purchase, or two unrelated ₹100 debits close together, is treated as a duplicate and the second is dropped with `skipped_duplicate += 1` and never surfaced — real financial data silently lost, not just over-cautious dedup.
  Fix: add `Transaction.type == parsed["type"]` (and ideally merchant similarity) to the `duplicate_nearby` query; the DB unique index on `(user_id, raw_text)` already covers true retries, so this heuristic can be narrowed safely.

- **[fintrack/src/api/endpoints/transactions.ts:55-61, src/hooks/useCreateTransaction.ts]** No idempotency key on transaction creation
  Why it matters: the submit button is correctly disabled while pending, which stops double-tap duplicates, but there's no protection against the classic failure mode: the POST succeeds server-side, the response is lost to a timeout/dropped connection, `onError` fires, and the user reasonably retries — creating two transactions for one purchase.
  Fix: generate a UUID client-side in `useCreateTransaction` and send it as an `Idempotency-Key` header/body field; have the backend dedupe on it (it already has a unique-index pattern for this in `sms.py`/`transactions.py`, this just needs a client-supplied key extended to manual entry).

- **[fintrack/src/store/useUserStore.ts:23-28 <-> app/_layout.tsx:24-31]** Logout never clears the react-query cache — cross-account data leak on a shared device
  Why it matters: `logout()` only clears SecureStore and the user store; the module-level `queryClient` is untouched, and most query keys (`["accounts", ...]`, `["budgets"]`, `["net-worth"]`) aren't scoped by user id. With `staleTime: 5 minutes`, a second person logging into the same device within that window can see the previous user's cached balances/budgets rendered before any refetch — a real cross-account leak for a finance app, not a cosmetic bug.
  Fix: in `logout()`, call `queryClient.clear()` right after clearing storage.

- **[fintrack/src/utils/storage.ts:7-20]** Web build stores the JWT in `localStorage` — unfixed since last week
  Why it matters: the code comment says this is "fine for browser-based testing," but the repo ships a real `deploy` script (`npx expo export -p web && wrangler deploy`) targeting Cloudflare Workers — this is a live production path, not just local testing. Any XSS on the web bundle can exfiltrate every logged-in web user's access token, unlike native builds which correctly use `expo-secure-store`.
  Fix: gate the `localStorage` fallback behind a dev-only flag so a production web build fails loudly instead of silently downgrading, or move the web target to an httpOnly-cookie session issued by the backend.

- **[fintrack/app/(modals)/add-expense.tsx:67-76]** No numeric validation on the amount field — unfixed since last week
  Why it matters: the check is only `!amount.trim()`, so typing `"abc"` passes, then `parseFloat("abc")` is `NaN`; `JSON.stringify` serializes `NaN` as `null`, so a manual transaction can be submitted with `amount: null` and rejected only by the backend's opaque array-shaped 422 (see Cross-repo section). The sibling screen `add-budget.tsx:44-48` already does this correctly with an `isNaN`/`<= 0` guard.
  Fix: apply the same `isNaN`/`<= 0` guard used in `add-budget.tsx` before calling `createTransaction`.

## Medium (P2) - worth doing

- **[fintrack-backend/app/config/database.py:22, app/config/init_db.py:145]** Full database connection string, including credentials, printed to stdout on every startup
  Why it matters: `DATABASE_URL`/`engine.url` for a standard managed Postgres URL is `postgresql://user:password@host/db`; printing it routinely ends up retained in a platform's log aggregator.
  Fix: `engine.url.render_as_string(hide_password=True)` before logging.

- **[fintrack-backend/app/utils/oauth_state.py:8]** OAuth state store is an in-process `dict` — unfixed since last week
  Why it matters: single-use + TTL logic is correct and well tested, but it's process-local memory; any deployment with more than one worker/replica will intermittently reject legitimate OAuth callbacks when `/authorize` and `/callback` land on different processes.
  Fix: back it with Redis or a DB table using the same single-use-pop + TTL interface.

- **[fintrack-backend/app/api/transactions.py:117-131 (and mirrored in sms.py:93-104)]** Transaction insert and budget `spent_amount` sync are two separate commits, not one atomic write
  Why it matters: if the post-commit `BudgetService.sync_for_categories` call fails, the client sees a 500 even though the money was already recorded — meaningfully de-risked by `list_active_budgets` self-healing `spent_amount` on every read, but the request-level failure mode is still wrong.
  Fix: wrap both writes in one transaction/session, or catch-and-log the sync step rather than letting it propagate, since the read path already guarantees correctness.

- **[fintrack-backend/app/services/email_parser.py:184-190, gameable via app/api/transactions.py:246-249]** NEFT/IMPS/RTGS payments are auto-tagged "transfer" and excluded from spend, and a user can relabel any expense the same way
  Why it matters: these payment rails are equally used to pay a landlord or vendor, not just move money between one's own accounts, so real spend is silently excluded from insights/budgets; separately, `category` is a free string with no server-side restriction, so a user can `PATCH` any real expense's category to `"transfer"` to hide it from their own budget alerts.
  Fix: don't silently exclude NEFT/IMPS/RTGS by default — flag as "possible transfer, confirm?" or require a matching credit on one of the user's own accounts before excluding it from totals.

- **[fintrack-backend/app/services/recurring_service.py:36-45]** `detect_recurring` loads the user's entire debit history, unbounded, on every request
  Why it matters: no date filter before pulling all rows into Python for grouping — a full-table scan per `GET /api/recurring` call that grows unbounded with account age.
  Fix: bound the query to a recent window (e.g. 18 months) sufficient for the widest supported cadence plus one prior cycle.

- **[fintrack/app/(modals)/accounts.tsx:53]** Invalid opening balance silently becomes `0` instead of failing validation
  Why it matters: `parseFloat(openingBalance) || 0` means both `NaN` and a genuine `0` fall through to `0` — clearing the field or typing something non-numeric while editing an account silently overwrites the real opening balance with zero on save, corrupting account data without warning.
  Fix: validate with an explicit `isNaN` check and `Alert`, matching `add-budget.tsx`'s pattern, instead of coalescing.

- **[fintrack/src/utils/currency.ts:5-8]** Inconsistent fraction digits make amounts in the same list render with a different number of decimals
  Why it matters: `minimumFractionDigits: 0, maximumFractionDigits: 2` means ₹100 and ₹100.50 show a different decimal count side by side in a transaction feed, which reads as a formatting bug.
  Fix: set both to `2` for a stable two-decimal look, or make the "hide trailing .00" behavior an explicit, documented choice.

- **[fintrack, repo-wide]** No `accessibilityLabel`/`accessibilityRole` anywhere in the codebase
  Why it matters: a repo-wide grep across every `.tsx` file found zero occurrences, including icon-only controls on money/auth screens — the password-visibility toggle and every modal's `✕` close button announce nothing meaningful to a screen reader.
  Fix: add `accessibilityRole="button"` and a descriptive `accessibilityLabel` starting with auth and money-entry screens (login, signup, add-expense, add-budget, delete-account).

## Cross-repo contract issues

- **[fintrack-backend: no `RequestValidationError` handler in app/main.py <-> fintrack: every `error?.response?.data?.detail` call-site, e.g. app/(modals)/add-expense.tsx:142, app/(auth)/login.tsx:91, app/(auth)/signup.tsx:95,104, app/(modals)/add-budget.tsx:62, delete-account.tsx:34, edit-profile.tsx:43, accounts.tsx:36, categories.tsx:15]** FastAPI's default 422 response shapes `detail` as an **array** of `{loc, msg, type}` objects (e.g. from the `amount: Field(gt=0, le=100_000_000)` constraint in `app/schemas/transaction.py`, or the password/phone validators in `auth.py`), but every one of these frontend call-sites treats `detail` as a plain string and hands it straight to `Alert.alert`. When a 422 actually fires, the user sees `[object Object]`-style garbage instead of a helpful message. This is the same gap flagged in last week's review (2026-09-07) and remains unfixed.
  Fix: add a `RequestValidationError` handler in `app/main.py` that reshapes the response to `{"detail": "<readable string>"}` matching the rest of the API's envelope, and/or add a small `getApiErrorMessage()` helper on the frontend that checks `Array.isArray(detail)` and joins the `msg` fields as defense-in-depth.

- **[fintrack/src/types/api.d.ts:1-24 <-> fintrack-backend (no corresponding implementation)]** Dead frontend types describe a contract the backend doesn't implement
  What breaks: `ApiResponse<T>` (a `data/message/success` envelope), `PaginatedResponse<T>` (camelCase `hasMore`), `AuthTokens` (`accessToken/refreshToken/expiresIn`), and `GoogleAuthPayload` (`code/redirectUri`) are all unused (confirmed via repo-wide grep — nothing imports them). The backend never wraps responses in an envelope (routes return the Pydantic model directly), has no refresh-token exchange flow, and Google sign-in is a browser-redirect flow with a `token` query param on the deep link, not a `code`/`redirectUri` POST exchange. Not currently causing a runtime bug, but it actively misleads a future contributor into building against a contract that doesn't exist.
  Fix: delete `src/types/api.d.ts`, or replace its contents with the shapes actually returned by the endpoints it's meant to describe.

## Nits & style
- `fintrack-backend/requirements.txt` — no lockfile (`pip freeze`/`pip-compile` output) and most packages are pinned with `>=` rather than exact versions; the frontend correctly has `package-lock.json`. Worth adding a pinned/hashed requirements file for reproducible backend builds.
- `fintrack-backend/app/schemas/budget.py:7` — `limit_amount` has a positivity check but no upper ceiling, unlike `MAX_TRANSACTION_AMOUNT`/`MAX_OPENING_BALANCE` used elsewhere; add `le=MAX_TRANSACTION_AMOUNT` for consistency.
- `fintrack-backend/app/api/transactions.py:101`, `app/services/account_service.py:51` — client-supplied `currency` is accepted in the request schema but always silently overwritten with `"INR"` server-side, a half-migrated leftover from dropping multi-currency; drop the field from the request schemas or validate/reject non-INR values explicitly.
- `fintrack-backend/app/services/email_service.py:36-39` — dev-mode OTP-to-stdout fallback is correctly gated to `ENV == "development"` and raises otherwise; just confirm no shared/staging environment ever sets that value while logs are retained.
- `fintrack/app/(modals)/add-expense.tsx:141` — `console.log("Add transaction failed:", ..., error?.response?.data, ...)` logs the full backend error payload to the device console in production builds; harmless today (no secrets in these payloads) but should be gated behind `__DEV__`. Unfixed since last week.
- `fintrack/src/api/endpoints/auth.ts:144-147` — `authApi.refreshToken` is defined but never called anywhere in the app (confirmed via repo-wide grep); `client.ts` documents there's no refresh flow. Delete the dead code or wire it up for real. Unfixed since last week.
- `fintrack/src/store/useTransactionStore.ts` — no importer anywhere in the app (react-query is the actual source of truth for transactions); safe to delete.
- `fintrack` — no test files anywhere in the repo (`*.test.ts*`, `*.spec.ts*`, `__tests__` all return nothing), including for `formatCurrency`, auth flow, or transaction creation.

## What looks good
- Ownership checks are enforced at the DB-query level everywhere reviewed, not "fetch then check" — `AccountService.get_own`, `BudgetService.get_budget`, `CategoryService.get_own`, and every transaction get/update/delete filter on `user_id == current_user.id` in the same query. No IDOR was found across accounts, transactions, budgets, or categories.
- The pending-OTP-token vs. real-access-token separation is deliberate and regression-tested: pending tokens carry a `purpose` claim that `verify_token` explicitly rejects on protected routes (closing exactly the auth-bypass class the repo's own history shows it hit and fixed in `8562574`), and OTP codes plus the admin key use `hmac.compare_digest` rather than `==`.
- Import deduplication is backed by a real partial unique index (`uq_transactions_user_raw_text`), not just an app-level check-then-insert, so concurrent syncs can't double-import — and the materialized `budgets.spent_amount` is self-healing, recomputing from actual transaction rows on every read.
- The frontend's session-expiry handling is genuinely well thought out: a guard prevents stacking multiple logout/alert cycles when several in-flight requests 401 at once, and it correctly distinguishes "session died mid-use" from "app cold-started with an already-dead token" so users aren't shown a spurious alert on every fresh launch. Money formatting is fully centralized (zero raw `.toFixed()` calls found anywhere), and IST timezone handling for date-range comparisons is careful and correct.
- Cross-repo alignment is unusually strong overall: consistent snake_case field names, matching enum values, a consistent Bearer-auth mechanism, and consistent pagination/filter parameter naming across every endpoint group checked (accounts, transactions, budgets, categories, recurring, insights, gmail, sms, auth) — a full inventory diff turned up only two real mismatches, both listed above.

## Suggested next steps
1. Fix the OAuth/Gmail open-redirect and token-in-URL leaks in `google_auth.py`/`gmail.py` (+ `useGmailConnect.ts`) — flagged two weeks running and still exploitable.
2. Require current-password confirmation (or new-email verification) before allowing an email change on `PATCH /api/auth/me`, closing the forgot-password account-takeover chain.
3. Add rate limiting and generic (non-enumerating) error responses to `/login` and `/forgot-password`; add a `token_version` claim so password reset actually revokes existing sessions.
4. Fix `env.ts` to fail loudly rather than falling back to `http://localhost:8000` in any non-development build.
5. Fix SMS-imported transactions to carry an `account_id` so balances/net-worth are correct, and narrow the SMS duplicate-detection query to also match transaction type.
6. Add the `RequestValidationError` handler on the backend so 422s match the app's error envelope; add a defensive `getApiErrorMessage()` helper on the frontend either way.
7. Clear the react-query cache on logout, add `isNaN`/positive-amount validation to `add-expense.tsx` and `accounts.tsx`, and add a client-generated idempotency key to transaction creation.
8. Schedule the `Float` → `Numeric`/`Decimal` migration for all money columns as its own tracked piece of work.
