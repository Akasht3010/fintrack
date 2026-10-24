# Fintrack Weekly Code Review - 2026-10-05

## Summary

Reviewed both halves of the stack: `fintrack` (React Native/Expo + TypeScript, also built for web via react-native-web) at commit `c452e4d`, and `fintrack-backend` (FastAPI + SQLAlchemy + Postgres, deployed as a single Cloud Run service) at commit `4629da1`. Both repos already went through a prior review round on 2026-09-15, and that round's fixes (the pending-token auth-bypass fix, the web `Alert.alert()` no-op fix, Decimal money precision) all hold up under re-inspection with regression tests backing most of them. This round surfaces two new **critical, unauthenticated** backend bugs that undercut that otherwise solid foundation: an LFI in the SPA static-file fallback that can dump every secret in the container (JWT signing key, DB credentials, encryption key), and an OAuth redirect-URI injection that lets an attacker steal any victim's session token through Google's own legitimate consent screen. Static analysis tools could only partially run — see the note at the end of this section. No committed secrets or `.env` files were found in either repo (only `.env.example` with placeholder values).

**Static analysis note:** this sandbox had no installed dependencies (`node_modules/` absent for the frontend, `fastapi` et al. not installed for the backend, `pip-audit`/`expo` CLI unavailable), so `npm run lint`, `tsc --noEmit`, `pytest --collect-only`, `pip-audit`, and `expo lint` could not run meaningfully — their output was all missing-module noise, not real findings, and is omitted below. `ruff check .` did run cleanly (all checks passed). `npm audit --omit=dev` ran against the committed lockfile and surfaced dependency CVEs, included below under Medium/nits where relevant to the vulnerable path.

## Critical (P0) - fix before deploy

- **[fintrack-backend/app/web.py:36-45]** Unauthenticated path traversal / LFI in the SPA static-file fallback → full secret exposure
  Why it matters: The catch-all route `GET /{path:path}` builds candidate file paths with `os.path.join(WEB_DIR, safe)`. Per the ASGI spec, `scope["path"]` is already percent-decoded before Starlette's router sees it, so a request to `/%2fetc/passwd` resolves to `path == "/etc/passwd"`. The only guard (`not safe.startswith("..")`) never checks for a leading `/`, and `os.path.join()` silently discards `WEB_DIR` whenever the second argument is absolute — verified directly: `os.path.join('/app/web', '/etc/passwd') == '/etc/passwd'`. The result is `FileResponse("/etc/passwd")` served to an unauthenticated caller. The same trick reaches `/proc/self/environ` inside the Cloud Run container, which dumps every environment variable: `SECRET_KEY` (forge a JWT for any user), `DATABASE_URL` (DB credentials), `ADMIN_API_KEY`, `ENCRYPTION_KEY` (decrypts every stored Gmail refresh token), `GOOGLE_CLIENT_SECRET`, `SMTP_PASSWORD`. This is a full-system-compromise primitive served off the root path with no auth check at all.
  Fix:
  ```python
  safe = os.path.normpath(path)
  if safe.startswith("..") or os.path.isabs(safe):
      return FileResponse(INDEX)
  for candidate in (
      os.path.join(WEB_DIR, safe),
      os.path.join(WEB_DIR, safe + ".html"),
      os.path.join(WEB_DIR, safe, "index.html"),
  ):
      real = os.path.realpath(candidate)
      if real.startswith(os.path.realpath(WEB_DIR) + os.sep) and os.path.isfile(real):
          return FileResponse(real)
  ```

- **[fintrack-backend/app/api/google_auth.py:52-64,74-118,129-138]** Open redirect on `app_redirect_uri` → full account takeover via Google's own consent screen
  Why it matters: `GET /api/auth/google/authorize` accepts `app_redirect_uri` as a free-form query param and binds it server-side to the OAuth `state` nonce (so it can't be tampered with in transit — this is the hardening from the prior review round), but the *value itself* is never checked against any allowlist of schemes/hosts. After a victim completes Google's real consent screen, `google_callback` (lines 107-118) redirects the browser to `{app_redirect_uri}?code=<exchange_code>` — wherever the attacker originally supplied. `POST /api/auth/google/exchange` (lines 129-138) then hands the bearer `access_token` to whoever presents that single-use code next, with no binding to the originating client (no PKCE, no Origin check). Attack: send a victim a link to `.../authorize?app_redirect_uri=https://attacker.example/cb`; the victim sees Google's own legitimate login UI and completes it normally; their browser is bounced to `attacker.example/cb?code=XXX`; the attacker's server immediately POSTs that code to `/exchange` and receives a valid access token for the victim's account — full read/write access to their transactions, accounts, budgets, and PII. `app/api/gmail.py:46-83` has the identical missing-allowlist pattern on its own `app_redirect_uri` (lower severity there since only a `gmail_connected=true/false` flag travels in that redirect, not a bearer token, but it's still an open redirect off a trusted domain, usable for phishing).
  Fix:
  ```python
  # In app/config, from env:
  ALLOWED_APP_REDIRECT_PREFIXES = ("fintrack://",)  # the app's own deep-link scheme(s) only

  def _validate_redirect(uri: str) -> str:
      if not uri.startswith(ALLOWED_APP_REDIRECT_PREFIXES):
          raise HTTPException(status_code=400, detail="Invalid redirect")
      return uri
  ```
  Call `_validate_redirect(app_redirect_uri)` at the top of both `google_authorize` and `gmail_authorize`, before `create_state(...)`.

## High (P1) - fix this sprint

- **[fintrack-backend/app/config/database.py:22]** Raw `DATABASE_URL`, including the plaintext DB password, printed to stdout on every process start
  Why it matters: `print(f"📦 Using database: {DATABASE_URL}")` logs the raw env var (`postgresql://user:password@host:5432/db`) in full to Cloud Run logs on every boot. `app/config/init_db.py:208` does the equivalent safely (`print(f"🔌 Database URL: {engine.url}")`, which uses SQLAlchemy's redacting `URL.__str__()`), so this line is an inconsistency, not an intentional choice.
  Fix:
  ```python
  from sqlalchemy.engine import make_url
  print(f"📦 Using database: {make_url(DATABASE_URL).render_as_string(hide_password=True)}")
  ```

- **[fintrack/src/utils/storage.ts:12-24]** JWT access token stored in `window.localStorage` on the web build, readable by any script on the page
  Why it matters: the comment there ("fine for browser-based testing, which is all the web target is for here") is stale — later commits (`711d3b5`, `fafb1aa`, `440cb9d`, `5e57549`) show the web build now points at the production Cloud Run backend and has a real desktop layout, not a throwaway test target. `localStorage` has no same-origin script isolation, so a single XSS anywhere on the page gives an attacker the bearer token outright, with no further exploit needed. `src/store/useUserStore.ts:24` and `app/_layout.tsx:73` read/write the same keys through this helper.
  Fix: on web, keep the token in memory only and re-authenticate silently on reload (via the refresh-token flow, which the app already has), or have the backend set it as an `httpOnly` cookie instead of returning it in the JSON body for web clients.

- **[fintrack/app/(modals)/add-expense.tsx:77-98]** No numeric/positivity validation on the transaction amount field
  Why it matters: both the create path (lines 77-86) and edit path (88-98) only check `!amount.trim()` before calling `parseFloat(amount)` (lines 92, 127). `keyboardType="decimal-pad"` is a native-only hint that `react-native-web` doesn't enforce, so on web a user can type `"abc"`, `"-50"`, or `"0"` and submit. `parseFloat("abc")` is `NaN`, and `JSON.stringify({amount: NaN})` serializes to `"amount":null`, so a transaction can be POSTed/PATCHed with a null or negative amount, corrupting money data. `app/(modals)/add-budget.tsx:48-52` already has the right pattern (`isNaN(amount) || amount <= 0` → alert) — this screen just doesn't use it.
  Fix: mirror add-budget's guard before calling `createTransaction` / `transactionApi.update`:
  ```ts
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    showAlert("Invalid amount", "Enter an amount greater than zero.");
    return;
  }
  ```

- **[fintrack/app/(modals)/accounts.tsx:51,176]** Invalid opening-balance input is silently coerced to `0`, not rejected
  Why it matters: `opening_balance: parseFloat(openingBalance) || 0` means any unparseable input (a stray character, an empty field after edits, a comma-formatted number) doesn't error — it quietly writes `0` as the account's opening balance (or outstanding credit-card balance), silently corrupting net-worth data with zero feedback to the user.
  Fix: validate explicitly instead of falling back:
  ```ts
  const parsed = parseFloat(openingBalance);
  if (openingBalance && isNaN(parsed)) {
    showAlert("Invalid amount", "Enter a valid opening balance.");
    return;
  }
  ```

## Medium (P2) - worth doing

- **[fintrack-backend/app/api/auth.py:220,307]** `/verify-otp` and `/reset-password` have no rate limit, unlike `/login` and `/forgot-password` (both `10/minute`). Brute force is still bounded by `MAX_OTP_ATTEMPTS=5` per OTP row and a 30s resend cooldown, so this isn't readily exploitable today, but it removes a layer of defense-in-depth against a distributed attempt that mints fresh `pending_token`s from many IPs. Fix: add `@limiter.limit("10/minute")` to both for consistency with the rest of the auth surface.
- **[fintrack-backend/app/api/gmail.py:78]** `return RedirectResponse(f"{app_redirect_uri}{separator}gmail_connected=false&error={str(e)}")` reflects a raw internal exception message into a redirect URL, which can end up in browser history and intermediary access logs. Fix: redirect with a fixed generic error code and log the real exception server-side only.
- **[fintrack-backend/tests/]** Coverage gaps: no `test_categories.py`, `test_recurring.py`, `test_admin.py`, `test_gmail.py`, or `test_google_auth.py` exist. `test_accounts.py` and the category endpoints have no cross-user IDOR test (unlike `test_transactions.py:80,163` and `test_budgets.py:189`, which explicitly assert cross-user isolation). The category-rename cascade in `CategoryService.update` (bulk-updates `Transaction.category`/`Budget.category`) also has no test. Fix: backfill IDOR tests for accounts/categories and add coverage for the OAuth and admin routes, which are exactly the kind of code that regresses silently.
- **[fintrack-backend/app/api/insights.py:59,87,109, app/services/admin_service.py:197,205]** `float(r.total or 0.0)` converts a `Decimal` SQL sum to `float` for read-only display aggregates. Not written back to storage, so not a correctness bug, but inconsistent with the `Money`/Decimal discipline used everywhere else and can produce `1234.5600000000001`-style display artifacts for pathological sums. Fix: keep as `Decimal`/round explicitly, e.g. `round(float(r.total or 0), 2)`.
- **[fintrack/src/api/client.ts:85-101]** `getFreshAccessToken` falls back to the same (possibly already-expired) token when proactive refresh fails (`return refreshed ?? token` at line 100) instead of failing fast. The request goes out, gets a 401/403, and only then does the response interceptor (122-140) log the user out — functionally recovers, but wastes a round trip and lets a money-submitting request momentarily appear to proceed before failing. Fix: when refresh fails and the token's `exp` has already passed, return `null` so the caller can short-circuit to the login flow immediately.
- **[fintrack/src/store/useUserStore.ts:23-27, fintrack-backend/app/api/auth.py]** Logout only clears local storage; there is no backend revoke/blacklist endpoint and no call to one. Combined with the `localStorage` finding above, a token captured before "logout" stays valid against the backend until its own natural expiry. Fix: add a backend session-revocation endpoint and call it from the frontend's `logout()` before clearing local storage.
- **[fintrack/app/(tabs)/budget.tsx:44-52]** `handleDelete` awaits `budgetApi.delete(id)` with no `try/catch` and no per-row pending/error state, unlike every sibling delete flow (`accounts.tsx`, `categories.tsx`, `transaction-detail.tsx`, all on `useMutation` with `onError`). A failed delete throws an unhandled rejection and the user sees nothing happen. Fix: wrap in the same `useMutation` + `showAlert`-on-error pattern used elsewhere.
- **[fintrack/app/(tabs)/transactions.tsx:57-67]** `minAmount`/`maxAmount` are included directly in the query key, unlike `debouncedSearch` (400ms debounce at lines 40-43), so every keystroke while typing a filter amount fires a new request immediately. Fix: debounce the amount filters the same way the search box is debounced.
- **[fintrack/__tests__/]** Existing tests (`add-expense.smoke.test.tsx`, `login.smoke.test.tsx`) only assert "renders without crashing" — no coverage of amount validation, double-submit prevention, the idempotency key, OTP flow, or the 401/logout interceptor. Fix: add a test that types an invalid amount and asserts no `transactionApi.create` call fires, and one that asserts a failed login shows an error and does not navigate.
- **[fintrack/package-lock.json]** `npm audit --omit=dev` reports 70 advisories against the lockfile, including a critical ReDoS in `shell-quote` (pulled in transitively) and a high-severity CRLF injection in `form-data`. Most of the chain is dev/build tooling (metro, jest) not shipped to users, but worth a scheduled `npm audit fix` pass since several have non-breaking fixes available.

## Cross-repo contract issues

Full endpoint inventories were built from both repos (every FastAPI route decorator in `fintrack-backend/app/api/*.py`, and every `apiClient.*`/axios call in `fintrack/src/api/endpoints/*.ts` and `fintrack/src/api/client.ts`). No method mismatches, no endpoint the frontend calls that the backend doesn't serve (or vice versa for anything the main app is expected to use), and no field-name case drift were found — both sides consistently use snake_case matching the Pydantic schemas. Two points worth recording, neither a live bug:

- **[fintrack-backend/app/schemas/money.py:12 <-> fintrack/src/types/api.d.ts:5,22]** Money is `Decimal`/`Numeric(12,2)` end-to-end on the backend, but `Money = Annotated[Decimal, PlainSerializer(lambda v: float(v), ...)]` deliberately converts to a JSON number at the wire boundary (documented in the code as an intentional tradeoff to avoid changing the existing numeric wire contract), and the frontend types `amount` as `number` to match. This is consistent and not currently broken, but it is a deviation from the "money as strings on the wire" best practice — a `float` cannot exactly represent most two-decimal values, so very large aggregate sums (insights/admin totals) carry a theoretical precision risk that string transport would avoid. Not worth a breaking change given the current INR/₹-scale amounts, but worth keeping in mind if transaction volumes or amounts grow.
- **[fintrack-backend/app/api/admin.py:12,18 <-> fintrack frontend: no call site]** `GET /api/admin/health` and `GET /api/admin/stats` are never called anywhere in the `fintrack` app. This is expected, not dead code or a missing feature — the backend's most recent commit ("Allow fintrack-monitor (Firebase Hosting) to call the admin API") confirms these are consumed by a separate admin dashboard, not the end-user app.
- **[fintrack/src/api/endpoints/auth.ts:144-147 <-> fintrack-backend/app/api/auth.py:401]** `authApi.refreshToken()` is dead/duplicate frontend code with no call site — the actual token-refresh path is a separate raw-axios call in `src/api/client.ts:65-83` that correctly hits the same `POST /api/auth/refresh` endpoint. Not a contract break (the real path works), just confusing duplication — see Nits.

## Nits & style

- `fintrack-backend/app/api/transactions.py:145-146` — `min_amount`/`max_amount` query params are typed `float` and compared against the `Numeric(12,2)` column; filter-only so no correctness bug, but `Optional[Decimal]` would be more consistent with the rest of the money handling.
- `fintrack-backend/app/schemas/sms.py:11-12` — `SmsSyncRequest.messages: List[SmsMessage]` has no size cap; cheap insurance to add `Field(max_length=...)` even though the route is authenticated.
- `fintrack/src/store/useTransactionStore.ts` and `fintrack/src/hooks/useTransactionFilters.ts` — both fully defined, zero imports anywhere in the app. Harmless today, but a maintenance trap if someone later assumes `useTransactionStore` is the source of truth for transaction state.
- `fintrack/src/api/endpoints/auth.ts:144-147` — `refreshToken()` is dead/duplicate code (see Cross-repo section above); worth deleting to avoid confusion with the real refresh path in `client.ts`.
- `fintrack/app/(modals)/transaction-detail.tsx:50-53` — hardcodes `"Failed to delete transaction"` instead of using `extractErrorMessage(err, ...)` like every other catch block in the app, losing the real backend error message.
- No accessibility props (`accessibilityLabel`/`accessibilityRole`/`aria-label`) found anywhere in the 35 `.tsx` files checked — icon-only controls with no text alternative include the password show/hide toggle (`app/(auth)/login.tsx:160-165`, `signup.tsx:206-211`), every modal's `✕` close button, and the budget delete icon (`app/(tabs)/budget.tsx:131-136`).

## What looks good

- Money is `Decimal`/`Numeric(12,2)` end-to-end on the backend with a dedicated regression test proving no float drift across 30 accumulated transactions (`fintrack-backend/tests/test_money_precision.py:37-67`).
- Object-ownership (IDOR) checks are consistently applied across transactions/accounts/budgets/categories (e.g. `app/api/transactions.py:151,219-221,238-241,274-277`, `app/services/account_service.py:46-47`, `app/services/budget_service.py:132-133`) and backed by explicit cross-user regression tests (`tests/test_transactions.py:93,163`, `tests/test_budgets.py:189`).
- The prior review round's auth-bypass fix is solid and still holds: `verify_token` explicitly rejects any token carrying a `purpose` claim (`app/utils/auth.py:56-58`), with a regression test (`tests/test_auth.py:185`) confirming an OTP-pending token can never authenticate a protected route.
- The idempotency-key pattern on transaction creation (`fintrack/src/utils/idempotencyKey.ts`, wired through `add-expense.tsx` and `src/api/endpoints/transactions.ts:18`, enforced by a backend `(user_id, idempotency_key)` unique index) is a well-reasoned double-submit defense, and every money/PII form checked has its submit button correctly disabled while in flight.
- Currency formatting is solid and consistent: a single `formatCurrency` helper using `Intl.NumberFormat("en-IN", { currency: "INR" })` everywhere money is rendered, with zero stray `toFixed()` calls or hardcoded `"$"` found — the INR-only cleanup (commit `67d4ad9`) appears fully complete.
- The prior fix for `Alert.alert()` being a no-op on web is now fully and consistently applied — every screen routes through `showAlert`/`confirm` helpers that correctly branch to `window.alert`/`window.confirm` on web, with no call site bypassing them.

## Suggested next steps

1. Patch `fintrack-backend/app/web.py`'s path-traversal guard immediately (fix above) and audit Cloud Run access logs for any `%2f`/absolute-path requests that may indicate prior exploitation.
2. Add the `app_redirect_uri` allowlist check to both `google_auth.py` and `gmail.py` before the next deploy.
3. Drop or redact the raw `DATABASE_URL` print in `database.py`.
4. Add amount validation to `add-expense.tsx` and `accounts.tsx`, matching the existing pattern in `add-budget.tsx`.
5. Move the web build's token storage off `localStorage`, add a backend logout/revoke endpoint, and add rate limiting to `/verify-otp` and `/reset-password`.
6. Backfill the identified test gaps (backend IDOR tests for accounts/categories, OAuth/admin route coverage; frontend amount-validation and auth-failure-path tests).
