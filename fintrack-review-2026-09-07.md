# Fintrack Weekly Code Review - 2026-09-07

## Summary
Both repos are in good shape overall: auth uses bcrypt + OTP two-factor with constant-time comparisons, ownership checks on every transaction/account/budget read and write are consistent (no IDOR found), and a prior code-review pass (`8562574`, `edb6dc8`, `e4a6050` in fintrack-backend) already closed a real auth-bypass bug and several P1/P2 issues — that discipline shows. The two headline concerns this week are a real, exploitable OAuth open-redirect that can leak a user's access token to an attacker-controlled URL, and the use of `Float` (not `Decimal`/`Numeric`) for every money column and money computation, which is a correctness risk baked into the schema. Repos reviewed: `fintrack` @ `f97d1a235d763632cb7dc08b1a7044694b0b8834`, `fintrack-backend` @ `e4a6050becb36939c834825b5bcecac5ff1ef829`. Both backend and frontend were available and reviewed. Static tooling: `ruff check .` passed clean on the backend; `mypy`, `pytest`, `pip-audit`, `npm run lint`, and `tsc --noEmit` could not be run meaningfully because neither repo's dependencies are installed in this environment and the frontend has no lint/typecheck script configured (see Nits).

## Critical (P0) - fix before deploy

- **[fintrack-backend/app/api/google_auth.py:52-70,108-109]** OAuth login redirect is an open redirect that leaks the app's JWT to an attacker-controlled URL
  Why it matters: `/api/auth/google/authorize` accepts `app_redirect_uri` as a client-supplied query param with no allowlist check, binds it to the server-side state nonce, and on `/callback` does `return RedirectResponse(f"{app_redirect_uri}?token={access_token}")`. An attacker can send a victim a link like `https://<api>/api/auth/google/authorize?app_redirect_uri=https://evil.example/harvest`. The victim sees a legitimate Google consent screen (it's the real backend talking to real Google), and on completion the backend redirects their browser straight to `https://evil.example/harvest?token=<victim's real JWT>`. That token grants full read/write access to the victim's transactions, accounts, and profile until it naturally expires. The identical pattern exists in `fintrack-backend/app/api/gmail.py:31,42,54,59-65` for the Gmail-connect flow (there the leaked value is a Gmail-connected status flag rather than a token, but it's still an open redirect off a trusted domain, which is useful for phishing).
  Fix:
  Validate `app_redirect_uri` against an explicit allowlist of schemes/hosts the app actually uses (its Expo custom scheme, the `exp://`/Expo-Go proxy pattern used in dev, and the deployed web origin) before minting the state, and again before redirecting in the callback:
  ```python
  ALLOWED_REDIRECT_PREFIXES = (
      "fintrack://", "exp://", "exp+fintrack://",
      "https://<your-deployed-web-origin>/",
  )

  def _validate_redirect(app_redirect_uri: str) -> str:
      if not app_redirect_uri.startswith(ALLOWED_REDIRECT_PREFIXES):
          raise HTTPException(status_code=400, detail="Invalid redirect target")
      return app_redirect_uri
  ```
  Call `_validate_redirect` in both `google_authorize`/`gmail_authorize` (defense in depth) and again in the two `/callback` handlers right after `consume_state` (so a value that was valid when minted but shouldn't be trusted blindly at redirect time is still checked).

- **[fintrack-backend/app/models/transaction.py:11, app/models/account.py:17, app/services/account_service.py:16-48]** Money is stored and computed as `Float`, not `Decimal`/`Numeric`
  Why it matters: `Transaction.amount` and `Account.opening_balance` are SQLAlchemy `Float` columns, and `compute_balance`/`_sum_in_account_currency`/`net_worth` do all arithmetic (including `SUM()` aggregation and currency conversion) in IEEE-754 floats. This is the classic fintech bug class: `0.1 + 0.2 != 0.3`. Every balance, net-worth figure, and budget "spent" total in this app is a running sum of floats, so rounding error compounds with transaction volume and will eventually show a user a balance that's off by a cent (or more, after conversion multiplications in `to_home_currency`). Pydantic (`app/schemas/transaction.py:22`) also types `amount: float`, so the imprecision starts at the API boundary too.
  Fix:
  Migrate `amount` and `opening_balance` to `Numeric(14, 2)` (or `Numeric` with an explicit scale per currency's minor unit) and use Python's `Decimal` throughout `account_service.py`, `budget_service.py`, and the transaction schemas instead of `float`:
  ```python
  # models
  amount = Column(Numeric(14, 2), nullable=False)
  opening_balance = Column(Numeric(14, 2), nullable=False, default=0)

  # schemas
  from decimal import Decimal
  amount: Decimal = Field(gt=0, le=MAX_TRANSACTION_AMOUNT, max_digits=14, decimal_places=2)
  ```
  This needs a migration (there's no Alembic setup here — `init_db.migrate_schema()` is doing ad hoc `ALTER TABLE`s, so add the column-type change there) and a full-repo pass converting `float(...)` calls in `account_service.py`/`exchange_rate_service.py` to `Decimal`. Flagging for prioritization, not fixing here per the review-only scope.

## High (P1) - fix this sprint

- **[fintrack-backend/app/api/auth.py:164-200, 247-273]** No rate limiting on `/login` or `/forgot-password`
  Why it matters: `verify_password` (bcrypt) and OTP issuance both run with no per-IP or per-account throttle. `/login` also distinguishes "no account found" (404) from "incorrect password" (401), so it's a working account-enumeration oracle, and an attacker who has enumerated valid identifiers can brute-force passwords at whatever rate the server allows — bcrypt slows this down per-guess but doesn't stop it, and there's no lockout after N failures the way OTP verification has (`otp_service.py:87-88`, `MAX_OTP_ATTEMPTS = 5`). `/forgot-password` has the same enumeration leak and can be used to spam a victim's inbox with reset OTPs (bounded only by the 30s resend cooldown, which is per-user not per-IP).
  Fix:
  Add a rate limiter keyed by IP + identifier on `/login`, `/forgot-password`, and `/verify-otp`. Redis is already a dependency (`requirements.txt`, used for Celery), so a small fixed-window limiter against it is cheap:
  ```python
  from app.config.redis_client import redis_client  # new thin wrapper

  def check_rate_limit(key: str, limit: int, window_seconds: int):
      count = redis_client.incr(key)
      if count == 1:
          redis_client.expire(key, window_seconds)
      if count > limit:
          raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
  ```
  Call it in `login()` keyed on `f"login:{request.identifier}"` (e.g. 10/hour) and in `forgot_password()` similarly. Also consider returning a uniform "if an account exists, we've sent instructions" message from `/forgot-password` instead of a 404, closing the enumeration oracle there.

- **[fintrack-backend/app/api/gmail.py:30,34, fintrack/src/hooks/useGmailConnect.ts:40]** User's live access token is sent as a URL query parameter
  Why it matters: `GET /api/gmail/authorize?token=<jwt>&app_redirect_uri=...` puts a live bearer token in the URL. URLs are routinely captured in server access logs, reverse-proxy/CDN logs, browser history, and `Referer` headers sent to third parties (here, the redirect target is `accounts.google.com`, so Google's own edge could see it in a Referer header depending on browser policy) — all channels the app's own `Authorization: Bearer` header convention on every other endpoint is designed to avoid.
  Fix:
  Don't pass the raw JWT in the query string. Either (a) require the client to call this endpoint with a normal `Authorization` header and read `current_user` via `Depends(get_current_user)` like every other endpoint, having the client open it via a same-origin fetch that then redirects, or (b) mint a short-lived, single-use opaque nonce server-side (via an authenticated POST) and pass only that nonce in the `authorize` URL.

- **[fintrack/src/utils/storage.ts:8-24]** JWT stored in `localStorage` on the web build
  Why it matters: The code comment says this is "fine for browser-based testing," but `package.json` (`"deploy": "npx expo export -p web && wrangler deploy"`) and `wrangler.jsonc` show this app is actually deployed to production as a Cloudflare Workers web app, not just used for local testing. `localStorage` is readable by any JavaScript running on the page, so a single XSS anywhere in the web bundle (or a compromised third-party script) can exfiltrate every logged-in user's access token. Native builds correctly use `expo-secure-store`; only the web target has this gap.
  Fix:
  At minimum, update the comment to reflect that this path is live in production and treat it as a known accepted risk, or better: for the web target, have the backend set the token as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie on the OAuth/login callback instead of returning it in a URL param the SPA stores itself, so JS on the page never touches the raw token.

## Medium (P2) - worth doing

- **[fintrack-backend/app/utils/oauth_state.py:8]** OAuth `state` nonces are held in an in-process Python dict
  Why it matters: `_pending_states` is process-local memory. If the app ever runs more than one worker/instance (common on Railway when scaling), a `/authorize` request handled by worker A and the matching `/callback` handled by worker B will fail with "Invalid or expired OAuth state" — and any deploy/restart between authorize and callback loses in-flight OAuth attempts.
  Fix: Store pending state in Redis (already a dependency) with a TTL instead of an in-memory dict, so it's shared across processes and survives restarts.

- **[fintrack-backend/app/api/sms.py:18-35, app/schemas/sms.py:11-12]** `/api/sms/sync` accepts an unbounded array of messages, one DB round-trip + commit per message
  Why it matters: `SmsSyncRequest.messages: List[SmsMessage]` has no `max_length`, and the handler does a `db.query(...).first()` duplicate check plus a separate `db.commit()` per message in a loop. A client (malicious or just a phone with a huge SMS backlog) posting thousands of messages in one call means thousands of sequential round-trips and commits on one request, holding a DB connection for the whole duration.
  Fix: Add `messages: List[SmsMessage] = Field(max_length=500)` (pick a number well above realistic sync batches) to `SmsSyncRequest`, and consider batching the duplicate lookups into one `IN (...)` query instead of one `SELECT` per message.

- **[fintrack-backend/app/services/account_service.py:36-48, app/api/accounts.py:19-20]** N+1 balance computation on every account list / net-worth call
  Why it matters: `list_accounts` calls `AccountService.to_response(db, a)` per account, and each call runs `compute_balance` → two grouped-and-converted queries (`_sum_in_account_currency` for credits and debits). `net_worth()` does the same loop again. For a user with N accounts, listing accounts or fetching net worth issues `2N` queries. Not urgent at typical personal-finance account counts (a handful), but it's a real N+1 pattern that will show up in latency as accounts grow.
  Fix: Compute all accounts' credit/debit sums in one grouped query keyed by `(account_id, currency)` and distribute the results in Python, rather than querying per-account.

- **[fintrack/app/(modals)/add-expense.tsx:72-77]** Client-side amount validation only checks for non-empty, not a valid positive number
  Why it matters: `handleSubmit` checks `!amount.trim()` but not `Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0`. A value like `"abc"` or `"-50"` reaches `parseFloat` (→ `NaN` or a negative number) and is only caught by the backend's 422, at which point the (see Cross-repo section below) generic error handling shows a confusing message instead of "Enter a valid amount."
  Fix: Validate `amount` is a finite number `> 0` (and `<= MAX_TRANSACTION_AMOUNT`, mirroring the backend) before calling `createTransaction`, with a specific inline error.

## Cross-repo contract issues

- **[fintrack-backend: no `RequestValidationError` handler registered in app/main.py <-> fintrack: every `error?.response?.data?.detail` call-site, e.g. app/(modals)/add-expense.tsx:149, app/(auth)/login.tsx:88, app/(auth)/signup.tsx:92]** 422 validation errors have a different `detail` shape than every other error, and the frontend doesn't handle it
  What breaks: FastAPI's default handling of a Pydantic validation failure (e.g. a negative `amount`, an out-of-range value, a malformed `EmailStr`) returns `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` — `detail` is a **list of objects**, not a string. Every frontend call-site does `Alert.alert("Error", error?.response?.data?.detail || fallback)`, which assumes `detail` is always a string (true for every hand-raised `HTTPException` in the codebase, but not for FastAPI's automatic 422s). When a 422 actually fires — e.g. a stray client bug sends `amount: -5` or a category name that fails a length constraint — the user sees a broken alert (React Native's `Alert.alert` coercing an array/object to a string, typically rendering something like `[object Object]`) instead of a helpful message.
  Fix: Add a `RequestValidationError` exception handler in `fintrack-backend/app/main.py` that reshapes the response into the same `{"detail": "<readable string>"}` envelope the rest of the API uses:
  ```python
  from fastapi.exceptions import RequestValidationError
  from fastapi.responses import JSONResponse

  @app.exception_handler(RequestValidationError)
  async def validation_exception_handler(request, exc):
      first = exc.errors()[0]
      field = ".".join(str(p) for p in first["loc"] if p != "body")
      return JSONResponse(status_code=422, content={"detail": f"{field}: {first['msg']}"})
  ```

## Nits & style
- `fintrack/src/api/endpoints/auth.ts:144-147` — `authApi.refreshToken()` is defined but never called anywhere in the app; sessions just die after the 30-minute access-token TTL and force a full login+OTP re-auth. Either wire it up (e.g. proactively refresh on 401 before logging out) or remove the dead code.
- `fintrack/src/utils/currency.ts:5` — locale is hardcoded to `"en-IN"` regardless of the currency being formatted, so a USD amount renders with Indian digit grouping (e.g. `$1,23,456` instead of `$123,456`). Pick the locale based on currency, or accept a locale param.
- `fintrack/app/(modals)/add-expense.tsx:146` — `console.log("Add transaction failed:", ..., error?.response?.data, ...)` logs full backend error payloads to the device console in production builds; harmless today (no secrets in these payloads) but worth trimming or gating behind `__DEV__`.
- No lint script and no ESLint config exist in the `fintrack` `package.json`/repo root, so `npm run lint` isn't runnable at all. Worth adding even a minimal ESLint config given the codebase's size.

## What looks good
- Auth is genuinely careful: OTP codes are hashed (SHA-256) and compared with `hmac.compare_digest`, pending (pre-OTP) tokens carry a `purpose` claim that's explicitly rejected by `verify_token` so they can't be replayed against protected routes (`app/utils/auth.py:50-64`) — this closes exactly the auth-bypass class the repo's own history shows it hit and fixed (`8562574`).
- Ownership checks are consistent everywhere: every transaction/account/budget read, update, and delete filters by `user_id == current_user.id` before acting, and no IDOR was found across `transactions.py`, `accounts.py`, or `budgets.py`.
- Startup posture is fail-loud rather than fail-open: `SECRET_KEY` has no hardcoded fallback and crashes the app at import time if unset (`app/utils/auth.py:12-17`), and OTP emails are only allowed to silently print to console when `ENV=development` explicitly — a misconfigured production deploy raises instead of leaking 2FA codes to logs (`app/services/email_service.py:30-43`).
- Multi-currency money handling is deliberately correct rather than naive: every aggregate query groups by currency before summing, and conversion happens explicitly in Python before totals are combined (`app/api/insights.py:38-42`, `account_service.py`) — the code even comments on why a plain SQL `SUM()` would be wrong here.
- Test coverage on the money/auth paths is real, not token: `tests/test_auth.py` (194 lines, 18 test functions) and `tests/test_transactions.py`/`test_accounts.py`/`test_budgets.py` (163/150/85 lines) exercise signup, login/OTP, and transaction/account/budget CRUD, which is exactly where fintech bugs hide.

## Suggested next steps
1. Fix the OAuth `app_redirect_uri` open redirect in `google_auth.py`/`gmail.py` — it's exploitable today and the highest-impact item in this review.
2. Add rate limiting to `/login`, `/forgot-password`, `/verify-otp` using the Redis instance already in the stack.
3. Plan (don't rush) the `Float` → `Numeric`/`Decimal` migration for `Transaction.amount` and `Account.opening_balance`; this touches a migration plus several service files, so scope it as its own piece of work.
4. Add the `RequestValidationError` handler so 422 responses match the rest of the API's error envelope, then have the frontend's amount input validate client-side too.
5. Move the Gmail-connect flow off passing the access token as a URL query param.
6. Revisit web token storage now that the web build is a real deployment target, not just a dev convenience.
