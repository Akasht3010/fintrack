# Fintrack Weekly Code Review - 2026-09-21

## Summary

Both repos were reviewed: `fintrack` (Expo Router / React Native + TypeScript, TanStack Query, Zustand, axios) at commit `c452e4d0af9ce1791056fff86e9a977425b54395`, and `fintrack-backend` (FastAPI + SQLAlchemy + Pydantic v2, Postgres, JWT + email OTP auth) at commit `4629da17c88c2c1adf8e5971a223081c96458754`. Both were available and fully reviewed. This is a maturing, already-hardened codebase — last week's review fixed Decimal money math, rate limiting on login/forgot-password, token-in-URL leaks, and IDOR-safe ownership checks, and this round's testing confirms those fixes hold up (including a dedicated regression test for the previous auth-bypass fix). Three new **P0s** surfaced this round: a real account-takeover path through the Google OAuth callback's unvalidated redirect target, database credentials printed to process logs on every backend startup, and a cross-account data leak in the frontend's query cache that never clears on logout. None of these were present in, or masked by, last week's fixes — they're new findings from this round's deeper OAuth-flow and cache-lifecycle review. Static analysis was constrained by this sandbox having no installed dependencies (`ruff` ran clean; `mypy`/`tsc`/`eslint` mostly reported missing-import noise, though `mypy` did catch a real return-type lie in `user_service.py`); no secrets were found in either repo's source or `.env*` files.

## Critical (P0) - fix before deploy

- **[fintrack-backend/app/api/google_auth.py:52-138]** Account takeover via unvalidated OAuth redirect target
  Why it matters: `app_redirect_uri` is taken verbatim from the client query string in `/api/auth/google/authorize` (line 52-64), bound only to a server-side nonce, and echoed unchanged into the final redirect from `/api/auth/google/callback` (line 74-118): `RedirectResponse(f"{app_redirect_uri}?code={exchange_code}")`. `POST /api/auth/google/exchange` (line 129-138) then trades that code for a real access token with no other authentication check — whoever presents the code gets the token. An attacker can send a victim a link to `.../api/auth/google/authorize?app_redirect_uri=https://attacker.example/x`; the victim completes a completely legitimate Google consent screen, and Fintrack's own callback redirects their browser to the attacker's domain carrying the exchange code. The attacker calls `/exchange` and obtains a fully valid bearer token for the victim's account — full read/write access to their transactions, balances, budgets and PII.
  Fix:
  ```python
  ALLOWED_REDIRECT_PREFIXES = ("fintrack://", "https://app.fintrack.example/")  # real registered targets

  def _validate_redirect(uri: str) -> str:
      if not uri.startswith(ALLOWED_REDIRECT_PREFIXES):
          raise HTTPException(status_code=400, detail="Invalid redirect target")
      return uri
  ```
  Call `_validate_redirect(app_redirect_uri)` before `create_state(...)` in `/authorize` (line 60) and again before the final `RedirectResponse` in `/callback` (line 82-83).

- **[fintrack/src/store/useUserStore.ts:23-27]** TanStack Query cache is never cleared on logout - cross-account data leak on a shared device
  Why it matters: `logout()` only clears `SecureStore` (`access_token`, `user`) and zustand state; it never touches the module-scoped `queryClient` (`app/_layout.tsx:24-31`, `staleTime: 5 * 60_000`). Both real logout paths — `app/(tabs)/profile.tsx:43-51` and `app/(modals)/delete-account.tsx:30-38` — call `logout()` then `router.replace("/(auth)/login")` with no cache clear in between. Several query keys aren't scoped by user id at all: `["budgets"]`, `["accounts", {...}]`, `["net-worth"]`, `["categories", type]`, `["recurring"]`, `["transaction", id]` — only the transactions list consistently includes `user?.id`. On a shared or handed-down device, if a second person logs in within the 5-minute staleTime after the first signs out, screens can render the first user's budgets, account balances, net worth and transaction detail straight from cache before any network refetch resolves — a real money/PII exposure to the wrong account.
  Fix: clear the cache as part of the logout transition, and scope every remaining query key by `user?.id` as defense in depth:
  ```ts
  // app/_layout.tsx — wherever isAuthenticated flips true -> false
  useEffect(() => {
    if (!isAuthenticated) queryClient.clear()
  }, [isAuthenticated])
  ```

- **[fintrack-backend/app/config/database.py:22]** Database connection string (with credentials) printed to logs on every startup
  Why it matters: `print(f"📦 Using database: {DATABASE_URL}")` runs at import time on every process boot — including every Cloud Run cold start and restart in production. `DATABASE_URL` for a managed Postgres instance is `postgresql://user:password@host/db`; printing it unmasked puts the DB password in stdout, which Cloud Run's log aggregator captures by default and which is often forwarded to a third-party log sink. Anyone with log-viewer access to the project — a much larger set of people than "who has DB access" — gets the DB password. The same pattern exists at `app/config/init_db.py:208` (`print(f"🔌 Database URL: {engine.url}")`, only reachable when that module is run standalone, not from the production app, but worth fixing for consistency).
  Fix:
  ```python
  from sqlalchemy.engine import make_url
  print(f"📦 Using database: {make_url(DATABASE_URL).render_as_string(hide_password=True)}")
  ```
  And at `init_db.py:208`: `engine.url.render_as_string(hide_password=True)`.

## High (P1) - fix this sprint

- **[fintrack-backend/app/api/gmail.py:45-83]** Same open-redirect gap in the Gmail-link OAuth flow (no token leak, but still a phishing vector)
  Why it matters: `app_redirect_uri` is echoed unchecked into the final redirect from `/api/gmail/callback`, same as the Google sign-in flow above, just without a token attached — it only carries `gmail_connected=true/false`. Still usable to redirect an authenticated user's browser from a trusted `fintrack.*` origin to an arbitrary attacker domain (a classic open-redirect phishing amplifier), and it's one field-rename away from becoming a token leak if this endpoint ever carries more than a boolean.
  Fix: apply the same `_validate_redirect()` allowlist as the P0 fix above to `gmail_authorize` (line 45-49) and `gmail_callback` (line 65-83).

- **[fintrack/src/utils/storage.ts:8-24]** JWT access token stored in `window.localStorage` on the production web build
  Why it matters: the `isWeb` branch stores `access_token`/`user` via `localStorage`, justified by a comment claiming this is "fine for browser-based testing, which is all the web target is for here" (line 4-7). That's contradicted by `app.json`'s `web` config (a real Expo Router static web export) and by `package.json`'s `deploy`/`preview` scripts (`expo export -p web && wrangler deploy`) plus the backend's own `Allow fintrack-monitor (Firebase Hosting) to call the admin API` commit — this is a real, shipped production target, not a test harness. `localStorage` has no XSS isolation: any injected or third-party script on the page can read the token directly, unlike SecureStore/Keychain/Keystore on native. A fintech bearer JWT in `localStorage` on a real production web build is a standard XSS-to-account-takeover vector.
  Fix: either scope the `localStorage` fallback to non-production builds only, move web auth to a same-origin httpOnly-cookie session brokered by the backend, or at minimum correct the misleading comment and get an explicit sign-off on the tradeoff for the real production web deployment.

- **[fintrack-backend/app/utils/rate_limit.py:16]** Rate limiting is keyed on `request.client.host`, which is unreliable behind this app's actual deployment
  Why it matters: `Limiter(key_func=get_remote_address, ...)` is used for the `10/minute` limits on `/login` and `/forgot-password` (`app/api/auth.py:174,269`). The `Dockerfile`/`ENVIRONMENTS.md` confirm this runs as a single Cloud Run service behind Google's front-end proxy, and nothing in `app/main.py` or `run.py` configures uvicorn to trust `X-Forwarded-For`. Behind that proxy, `request.client.host` sees the proxy's own connecting address, not the real client IP — so the 10/minute limit either applies to all users collectively sharing one apparent IP (a burst of legitimate traffic locks everyone out) or is otherwise meaningless, depending on Cloud Run's connection pooling. Either way, the limiter doesn't provide the per-attacker brute-force protection its `10/minute` intent implies on a fintech login endpoint.
  Fix: run uvicorn with `--proxy-headers --forwarded-allow-ips="*"` (Cloud Run is a single trusted hop) or wrap the app in `uvicorn.middleware.proxy_headers.ProxyHeadersMiddleware`, then verify in staging that `get_remote_address` sees real client IPs before relying on it.

- **[fintrack-backend/app/api/auth.py:220,244]** No rate limiting on `/verify-otp` or `/resend-otp`
  Why it matters: `/login` and `/forgot-password` are the only auth endpoints with `@limiter.limit`. Once an attacker holds a `pending_token` (e.g. after a correctly-guessed or leaked password), they can call `/resend-otp` every 30 seconds indefinitely — bounded only by `otp_service.py`'s intrinsic cooldown, not any IP limiter — and get 5 fresh guesses against the 6-digit code each cycle (`MAX_OTP_ATTEMPTS = 5`, `otp_service.py:18,87-88`, reset on every new code). That's roughly 10 guesses/minute forever, with no account-level lockout or escalating backoff, chipping away at a 1,000,000-value keyspace on a flow that gates full account access.
  Fix: add `@limiter.limit("5/minute")` to both `/verify-otp` and `/resend-otp`, and consider a hard per-`pending_token` cap on total resends (e.g. 5) after which the flow must restart via `/login` or `/forgot-password`, which are rate-limited.

- **[fintrack/app/(modals)/add-expense.tsx:37]** Idempotency key generated once per screen mount, reused across retries with different data; budget/account create have no idempotency key at all
  Why it matters: `const idempotencyKeyRef = useRef(generateIdempotencyKey())` (line 37) is created once when the screen mounts and reused for every `handleSubmit` call on that visit — including a resubmit after the user fixes a validation error and taps Save again with different field values. If the backend's `(user_id, idempotency_key)` uniqueness is keyed purely off the key, a resubmit with changed data but the same key risks the backend returning/deduping against the first (now-wrong) attempt. Separately, `budgetApi.create` (`src/api/endpoints/budgets.ts:16-19`) and the account-create call (`src/api/endpoints/accounts.ts:15-17`) never send an `idempotency_key` at all, unlike transactions — budgets happen to be protected by a backend 409 on duplicate category+period, but account creation has no such protection, so a double-tap or network retry can create a duplicate account.
  Fix: generate the key fresh inside `handleSubmit` rather than via `useRef` at mount, and add `idempotency_key` support to budget and account creation the same way `TransactionCreatePayload` already has it.

## Medium (P2) - worth doing

- **[fintrack-backend/app/api/auth.py:307-337]** Password reset does not invalidate access tokens issued before the reset
  Why it matters: `reset_password` sets `password_hash` and commits, but JWTs here are pure stateless bearer tokens — there's no token-versioning check in `verify_token` (`app/utils/auth.py:50-64`). If an attacker already holds a stolen access token, the victim's password reset (the exact remediation step taken after suspecting compromise) doesn't revoke it; it stays valid until its own 30-minute expiry. Mitigated somewhat by that short expiry, hence Medium not Critical.
  Fix: add a `token_version`/`password_changed_at` column on `User`, embed it as a JWT claim, and check it in `get_current_user`; bump it on password change.

- **[fintrack-backend/app/api/auth.py:146-171]** Signup grants a full access token with no verification the caller owns the supplied email/phone
  Why it matters: unlike `/login`, which requires OTP, `/signup` returns a usable `access_token` immediately. An attacker can pre-register an account against a real person's email/phone before that person signs up. It's largely self-healing (the real owner can reclaim it via `/forgot-password`, which does require an OTP to that inbox), but is inconsistent with the app's own OTP-gating design and lets an attacker use the account until the real owner notices.
  Fix: either require OTP verification before minting a token on signup (mirroring login), or explicitly document this as an accepted tradeoff given the self-healing reset path.

- **[fintrack-backend/app/utils/admin_auth.py:8-20]** Admin API key has no rate limiting
  Why it matters: `require_admin_key` compares correctly in constant time (`hmac.compare_digest`, line 19), but nothing rate-limits attempts against `/api/admin/health`/`/api/admin/stats`, so an attacker can throw unlimited guesses at `X-Admin-Key` if it's ever short/weak. Exposure is limited since admin endpoints return only aggregate counts, never per-user data, hence Medium not High.
  Fix: add IP-based rate limiting to the admin router and ensure `ADMIN_API_KEY` is generated with `secrets.token_urlsafe(32)` or longer.

- **[fintrack-backend/app/schemas/transaction.py:22-24]** No max length on free-text transaction fields (`category`, `merchant`, `description`)
  Why it matters: unlike `idempotency_key` (line 35, which does have `max_length=100`), an authenticated client can post arbitrarily large strings into these fields on every create/update — unbounded row growth, and a huge `category` string simply never matches a real category while still costing storage. Contrast with `app/services/email_parser.py:201-202`, which already truncates parser-derived values to sane lengths.
  Fix: `merchant: str = Field(max_length=200)`, `description: str = Field(max_length=500)`, `category: str = Field(max_length=100)`.

- **[fintrack-backend/app/utils/oauth_state.py:8]** OAuth pending-state store is an in-process Python dict - breaks under more than one worker/instance
  Why it matters: the nonce minted by `/authorize` (both `google_auth.py` and `gmail.py`) must be found by `/callback`, which Google may route to a different Cloud Run instance or uvicorn worker than the one that created it. Under any horizontal scaling this makes Google/Gmail sign-in intermittently fail with "Invalid or expired OAuth state" — and if the team's fix-under-pressure response is ever to loosen that check, it reopens exactly the forgeable-`state` bug this design was built to avoid. Same single-instance assumption underlies the rate limiter (`rate_limit.py:6-9`).
  Fix: back this with Redis or the DB before running more than one instance/worker; until then, document the constraint next to the Cloud Run scaling config.

- **[fintrack/app/(modals)/add-expense.tsx:92,127]** Money amounts sent as JS `number` (`parseFloat`), not decimal strings - fragile relative to the backend's Decimal contract
  Why it matters: the backend's `Money` type (`fintrack-backend/app/schemas/money.py:12`) is `Decimal` internally but serializes to JSON as a plain `float`, and Pydantic v2 accepts a JSON number back into that `Decimal` field. At today's scale (`Numeric(12,2)`, `MAX_TRANSACTION_AMOUNT = 100_000_000`) this round-trips exactly — no live precision bug was found — but it's an implicit invariant, not an enforced one. The same `parseFloat` pattern is used in `add-budget.tsx:48,58,60` and `accounts.tsx:51,176`. Nothing stops a future change (splits, discounts, client-side fee calc) from doing float arithmetic on these values before submission, silently reintroducing binary-float rounding into a money field.
  Fix: send amount fields as decimal strings once formatted to exactly 2 decimals, and have the backend's `Money` type accept string input explicitly, so the wire contract stops depending on an implicit float-JSON round-trip.

- **[fintrack/app/(tabs)/budget.tsx:44-52]** Budget delete has no error handling - fails silently
  Why it matters: `handleDelete` calls `await budgetApi.delete(id)` then `invalidateQueries` with no try/catch and no `showAlert`, unlike every sibling delete flow (`transaction-detail.tsx:46-53`, `accounts.tsx`'s remove mutation `onError`, `categories.tsx`'s remove mutation `onError`). A rejected DELETE (network blip, 403) throws an unhandled promise rejection; the user sees nothing and has no idea the budget is still there.
  Fix: wrap in try/catch and `showAlert("Error", extractErrorMessage(error, "Failed to delete budget"))` like the other three delete flows.

- **[fintrack/src/api/endpoints/transactions.ts:75-82 and siblings]** No request cancellation on unmount - `AbortSignal` never threaded through
  Why it matters: none of the `apiClient` calls in `src/api/endpoints/*.ts` accept or forward a `signal`, even though TanStack Query passes `{ signal }` as the second `queryFn` argument. Navigating away mid-request (flicking through Transactions filters, leaving Insights before it loads) doesn't actually abort the HTTP call — React Query just discards the result. Wasted bandwidth/battery, and a pile-up of abandoned in-flight requests on flaky mobile networks.
  Fix: thread `{ signal }` through, e.g. `queryFn: ({ signal }) => transactionApi.list(filters, { signal })`, with each endpoint function accepting an optional `AxiosRequestConfig`.

- **[fintrack/app/(modals)/add-expense.tsx:152]** Sensitive response data logged to the device console on transaction-create failure
  Why it matters: `console.log("Add transaction failed:", error?.response?.status, error?.response?.data, error?.message)` logs the full backend error payload, which can include field-level validation detail tied to the user's submitted amount/merchant/category. On Android that lands in logcat, readable by other apps with log-read permission on many OEM builds; on web it's plain devtools output.
  Fix: log only the status and a sanitized message, or gate the full payload behind `ENV.isDev`.

- **[fintrack/app/(auth)/login.tsx:160-165 and similar]** Accessibility: icon-only buttons missing `accessibilityLabel`/`accessibilityRole` across critical flows
  Why it matters: the password show/hide toggle on login/signup/reset-password is a bare `Ionicons` glyph with no text alternative; the same pattern recurs on the profile-edit pencil icon, the budget-row trash icon, and nearly every modal's "✕" close button (`add-expense.tsx:177-179`, `transaction-detail.tsx:61-63`, `add-budget.tsx:91-93`, and others) — a screen reader reads the glyph literally ("cross mark") instead of "Close". No `TouchableOpacity` in the app sets `accessibilityRole="button"`.
  Fix: add `accessibilityLabel`/`accessibilityRole="button"` to these controls, prioritizing the password toggle since it sits on the login/signup critical path.

- **[fintrack/src/api/client.ts:85-101]** `getFreshAccessToken` silently falls back to the stale token when a proactive refresh fails
  Why it matters: if `refreshAccessToken` throws (e.g. a transient network blip while backgrounded near expiry), `getFreshAccessToken` returns `refreshed ?? token` — sending the request with the old, soon/already-expired token rather than surfacing the failure. The follow-up request then 401/403s and the existing session-expiry handler logs the user out anyway, so the end-user-visible outcome is correct today, but a one-off bad-network moment forces a real logout that a single retry-with-backoff on the refresh call would avoid.
  Fix (nice-to-have): retry the refresh call once before giving up, or distinguish "network error talking to /refresh" from "refresh actually rejected."

## Cross-repo contract issues

- Endpoint-by-endpoint diff of the backend route inventory (`app/api/*.py` decorators) against the frontend's API call inventory (`src/api/endpoints/*.ts`) found **no missing endpoints, no method mismatches, and no field-name drift** — every backend route has a frontend caller (except `/api/admin/*`, which is ops-only by design), request bodies consistently use the backend's snake_case field names (`confirm_password`, `pending_token`, `new_password`, etc.), and the 422 validation-array vs plain-string `detail` error envelope is handled uniformly on the frontend (`src/api/client.ts:22-36`) rather than assumed to be one shape.
- **[fintrack-backend/app/schemas/money.py:12 <-> fintrack/app/(modals)/add-expense.tsx:92,127]** Money travels as a plain JSON number, not a decimal string, on both sides of the wire (backend serializes `Decimal` to `float` for JSON; frontend sends `parseFloat(amount)`). Not an active bug at today's value range/precision (see the P2 finding above), but it's a contract choice worth writing down explicitly rather than leaving implicit, since either side changing independently (backend switching to string serialization, frontend doing client-side math before submit) would silently break the other.
- `POST /api/auth/refresh` is implemented identically twice: once as `authApi.refreshToken()` (`fintrack/src/api/endpoints/auth.ts:144-147`, unused/dead) and once as the real proactive-refresh call in `fintrack/src/api/client.ts:65-83`. Both target the same backend endpoint (`fintrack-backend/app/api/auth.py:401-404`) and both correctly attach the bearer token via an `Authorization` header rather than a body, matching the backend's `Depends(get_current_user)` — so this isn't a contract bug, just a maintenance trap flagged again below.

## Nits & style

- `fintrack-backend/app/services/user_service.py:37,42,112` — `find_by_identifier` and `update_gmail_token` are typed to return `User` but both can return `None`; `mypy` correctly flags this (call sites already null-check where it matters, so it's a type-annotation accuracy issue, not a runtime bug).
- `fintrack-backend/app/api/transactions.py:145-146,173-174` — `min_amount`/`max_amount` query params are typed `float` against a `Numeric(12,2)` column; fine for read-only filtering, but inconsistent with the Decimal-everywhere discipline used for writes.
- `fintrack-backend/app/schemas/budget.py:9` — `limit_amount` has `gt=0` but no upper ceiling, unlike `MAX_TRANSACTION_AMOUNT`/account opening balance elsewhere.
- Several `except Exception` blocks swallow errors with a bare `print()` instead of the `logging` module (`app/api/gmail.py:101`, `app/api/auth.py:386`, `app/services/gmail_service.py:106,123`, plus the startup prints noted in the P0 finding) — acceptable as "best-effort, logged" per their own comments, but `print` output is easy to lose or misroute separately from the app's real log pipeline as the deploy evolves.
- `fintrack-backend/app/api/gmail.py:78` — the OAuth-exchange failure path embeds the raw exception string into a redirect URL query param (`error={str(e)}`); low risk since it's shown to the same user who initiated the flow, but still avoidable internal-detail leakage.
- `fintrack/src/types/api.d.ts` — `ApiResponse`/`PaginatedResponse`/`AuthTokens`/`GoogleAuthPayload` are disconnected from the real response shapes used everywhere (typed per-endpoint in `src/api/endpoints/*.ts` and `src/types/domain.ts`) and appear to be unused leftovers.
- Test coverage is thin beyond smoke tests: `__tests__/login.smoke.test.tsx` and `__tests__/add-expense.smoke.test.tsx` only assert the screens render; nothing covers token refresh/expiry, the 401/403 logout flow, OTP verification, or idempotency behavior. `src/utils/currency.test.ts` (7 cases) is a genuinely solid exception. On the backend, there's no test for the `google_auth.py` `/authorize` -> `/callback` -> `/exchange` flow (exactly where the P0 finding lives) and nothing asserting `/verify-otp`/`/resend-otp` are rate-limited (because they aren't).

## What looks good

- Money is `Decimal`/`NUMERIC(12,2)` end-to-end on the backend (models, `app/schemas/money.py`, service-layer math), with an explicit Postgres migration path for any pre-existing `FLOAT` columns — no float-drift risk in balances or budget sums.
- IDOR/ownership discipline is consistently correct on every id-scoped backend endpoint checked (transactions, accounts, budgets, categories) — every read and write filters by both the row id **and** `user_id`, backed by dedicated cross-user tests, not just app-level trust.
- The previously-flagged auth bypass (a pending/OTP token authenticating protected routes) is fully and correctly fixed, with a regression test (`test_auth.py::test_pending_token_cannot_authenticate_protected_routes`) — this round's review found no way around it.
- The frontend's token-refresh logic (`src/api/client.ts:63-140`) is genuinely well engineered: a shared `refreshPromise` de-dupes concurrent refreshes instead of a thundering herd, and a module-level flag collapses concurrent 401/403s into a single logout+alert, verified race-safe by JS run-to-completion semantics.
- A single, well-tested currency formatter (`src/utils/currency.ts`) pinned to `en-IN`/INR is used for every money display in the app — no stray `$` literals or ad-hoc `toFixed(2)` calls anywhere.

## Suggested next steps

1. Add the `app_redirect_uri` allowlist check to `google_auth.py` and `gmail.py`'s `/authorize` and `/callback` (small, isolated, closes the P0 account-takeover path).
2. Mask `DATABASE_URL` in the two startup print statements with `render_as_string(hide_password=True)` (one line each).
3. Clear the TanStack Query cache on the `isAuthenticated: true -> false` transition in `app/_layout.tsx` (or inside `useUserStore.logout()`), and scope the remaining unscoped query keys by `user?.id`.
4. Add `@limiter.limit` to `/verify-otp` and `/resend-otp`, and confirm `X-Forwarded-For` is trusted so the existing IP-based limits actually see real client IPs behind Cloud Run.
5. Move the `add-expense.tsx` idempotency key generation inside `handleSubmit`, and add `idempotency_key` support to budget and account creation.
6. Decide and document the intended security posture for the web build (`localStorage` vs. a brokered httpOnly-cookie session) rather than leaving the "testing only" comment in place for what is actually a shipped target.
7. Sweep `accessibilityLabel`/`accessibilityRole` onto icon-only buttons on the login/signup/budget screens, starting with the password visibility toggle.
