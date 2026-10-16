# Fintrack Weekly Code Review - 2026-10-12

## Summary
Reviewed `fintrack` (frontend, Expo/React Native + TypeScript) at `1fd7e4e` and `fintrack-backend` (FastAPI + SQLAlchemy/Postgres) at `5216c41`; both repos were available. The backend is in strong shape — every P0 from the 2026-09-15 review (Decimal money columns, login/reset rate limiting, token-in-URL removal, OAuth state persistence, admin CORS, path-traversal fix) is still correctly in place, IDOR ownership checks are consistent across every money endpoint checked, and OTP/token comparisons are constant-time. The frontend's newest commit (`1fd7e4e`, "Parse money fields as decimal strings...") has a real regression: it fixed the *read* side of money math but left every write path (add-expense, add-budget, account edit) still converting through `parseFloat`/JS `number`, and introduced a silent-zero-balance bug on invalid account edits. The headline finding this week is cross-repo: the frontend's new decimal-string contract (types, `money.ts`, commit message) describes a backend behavior that **was never shipped** — `fintrack-backend`'s `Money` type deliberately serializes to a JSON float, not a string — so the two repos now disagree, in writing, about what's actually on the wire.

## Critical (P0) - fix before deploy

- **[app/(modals)/accounts.tsx:52,178]** Invalid opening-balance edit silently zeroes the account
  Why it matters: `opening_balance: parseFloat(openingBalance) || 0` — if the input doesn't parse to a number (empty string, stray non-numeric character left after an edit), `parseFloat` returns `NaN`, and `NaN || 0` evaluates to `0`. Unlike every other money form in the app (`add-budget.tsx:49` validates and shows an error), this path has no validation and will silently overwrite a real account's opening balance with ₹0 on save — a direct, unprompted data loss on a money field.
  Fix:
  ```ts
  const parsed = parseFloat(openingBalance)
  if (!openingBalance.trim() || isNaN(parsed)) {
    showAlert("Error", "Please enter a valid opening balance")
    return
  }
  // use parsed, not `parseFloat(openingBalance) || 0`
  ```

## High (P1) - fix this sprint

- **[app/api/auth.py:220-266]** `/verify-otp`, `/resend-otp`, `/reset-password` have no rate limiting, unlike `/login` and `/forgot-password`
  Why it matters: `@limiter.limit("10/minute")` is present on `/login` (auth.py:174) and `/forgot-password` (auth.py:269) but missing on these three. The only throttle left is the per-OTP-row cap (5 wrong attempts, `otp_service.py:87-88`) and a 30s resend cooldown (`otp_service.py:52-54`) — both keyed on the OTP row, not the client IP, so a single IP can keep requesting fresh codes and burning 5 guesses every 30s indefinitely against a 6-digit code that gates login and password reset.
  Fix: add the same `@limiter.limit("10/minute")` decorator (plus the `Request` param it requires) to `verify_otp_endpoint`, `resend_otp_endpoint`, and `reset_password`.

- **[app/config/init_db.py:180-191]** Float→NUMERIC(12,2) column migration fails silently
  Why it matters: the `ALTER TABLE ... TYPE NUMERIC(12,2) USING ...` migration that converts legacy float money columns to exact Decimal is wrapped in `try/except Exception as e: print(...)` with no re-raise and no app-level signal. If it fails on an existing Postgres deploy (e.g. a row with a value the `USING` cast can't handle), the affected column silently stays `FLOAT`/`DOUBLE PRECISION` forever while the rest of the app — and this review's own backend findings — assume exact Decimal math is in effect. A `print()` in Cloud Run logs is easy to miss.
  Fix: at minimum, raise instead of swallowing (fail startup loudly), or set a `degraded_migrations` flag surfaced through `/health` so a stuck float column doesn't go unnoticed.

- **[app/api/gmail.py:144-147]** Internal exception text returned to the client on Gmail sync failure
  Why it matters: `detail=f"Couldn't reach Gmail: {str(e)}"` forwards whatever Google's client library/HTTP error says — possibly URLs, request metadata, or library internals — straight to the authenticated response body. The sibling handler 20 lines above it (`gmail.py:79-88`) explicitly avoids `str(e)` in a redirect for exactly this reason ("can carry response bodies or internal hostnames").
  Fix:
  ```python
  except Exception:
      logger.exception("Gmail sync failed for user_id=%s", current_user.id)
      raise HTTPException(status_code=502, detail="Couldn't reach Gmail right now. Please try again.")
  ```

- **[app/(modals)/add-expense.tsx:92,127, app/(modals)/add-budget.tsx:48,58,60]** Money write payloads still travel as JS `number`, not the string type the frontend now documents as the contract
  Why it matters: `amount: parseFloat(amount)` / `budgetApi.create({ limit_amount: amount })` send a JS `number` in the request body, while `TransactionCreatePayload`/`BudgetCreatePayload` type it as `number` too — but `domain.ts` and `money.ts` now describe every money field, in both directions, as a "decimal string." This isn't causing a functional failure today (see the cross-repo finding below — the backend's Pydantic `Decimal` field accepts a JSON number on input just fine), but it means the write side of the "parse money as decimal strings" fix was never actually done, despite the commit message claiming the whole pipeline was converted.
  Fix: either convert these call sites to send the raw validated string (`amount: amount.trim()`) to be internally consistent with the new types, or — better, see below — fix the actual contract mismatch first and then make both directions consistent with whatever that turns out to be.

- **[src/utils/storage.ts:6-13, src/api/client.ts:2]** Access token stored in `window.localStorage` on the web build, and the web build is a real production target
  Why it matters: the code comment calls this "fine for browser-based testing," but `README.md` documents the web build as shipping to production via Cloudflare Workers (`npm run deploy` → `wrangler deploy`), not a dev-only shim. `localStorage` is readable by any script that runs on the page (XSS), unlike an httpOnly cookie or in-memory token. `client.ts` imports this wrapper aliased as `SecureStore`, so the same code path is used for the real access token on the real deployed web app.
  Fix: for the web target, either move to an httpOnly-cookie session (needs backend support) or at minimum keep the token in memory only and re-authenticate silently on reload, rather than persisting it in `localStorage`.

## Medium (P2) - worth doing

- **[app/api/auth.py:146-147]** `/signup` has no rate limiting (only `/login` and `/forgot-password` do) — unlimited signup attempts can be used to hammer the (email, phone) uniqueness-check queries. Add `@limiter.limit(...)`.
- **[app/store/useUserStore.ts:23-27, app/api/auth.py:401-404]** Logout is client-side only — there is no server-side token revoke/blacklist, so a token copied off a device (or lifted from web `localStorage`, see above) stays valid until its own expiry. This is bounded by the 30-minute `ACCESS_TOKEN_EXPIRE_MINUTES` default, which limits the blast radius, but is still worth a short-TTL blacklist or a dedicated `/logout` endpoint for a finance app.
- **[app/schemas/sms.py:11-12]** `SmsSyncRequest.messages: List[SmsMessage]` has no `max_length`, and `app/api/sms.py`'s per-message loop does 2-3 queries + a commit per item — an authenticated client posting a very large array causes a serial DB hammering with no cap, unlike the Gmail sync path which is naturally bounded (`max_results=50`). Add `Field(max_length=200)` or similar.
- **[app/schemas/transaction.py:22-24]** `merchant`/`description` are plain `str` with no `max_length`, unlike `AccountCreate.name` (`max_length=60`) right next to them in the same module style. These fields also feed an `ilike` search filter (`transactions.py:62`) and CSV export. Add `Field(max_length=120)` / `Field(max_length=500)`.
- **[app/services/admin_service.py get_stats]** ~15 sequential unbounded full-table aggregate queries per `/api/admin/stats` call. Admin-key gated, not a security issue, but will slow down as the transactions table grows and this endpoint is polled by a monitoring dashboard.
- **[app/(tabs)/budget.tsx:102]** `toDecimal(spent).div(toDecimal(limit)).times(100)` has no zero-guard, unlike the matching guard added in the same commit at `budgetAlerts.ts:15` (`if (limit.lte(0)) continue`). In practice this can't be triggered today — `app/schemas/budget.py:9,16` enforces `limit_amount: Money = Field(gt=0)` server-side, so a zero-limit budget can't be created via the API — but it's an inconsistency worth closing defensively (`const percent = limit.lte(0) ? 0 : ...`) in case that constraint ever moves.
- **[app/ (no accessibilityLabel anywhere)]** `grep -r accessibilityLabel app` returns nothing. Icon-only controls on core money flows (password-visibility toggle, modal close "✕", home "+" add button) have no accessible label. Add `accessibilityLabel`/`accessibilityRole="button"` on at least these three.
- **[__tests__/*.smoke.test.tsx]** Smoke tests only assert "renders without crashing" — no test submits a transaction/budget form or asserts on the payload shape, which is exactly what would have caught the `parseFloat` write-path finding above. `currency.test.ts`/`budgetAlerts.test.ts` (added in `1fd7e4e`) are solid for the pure money-math functions they cover.

## Cross-repo contract issues

- **[fintrack-backend/app/schemas/money.py:12 <-> fintrack/src/utils/money.ts:1-9, fintrack/src/types/domain.ts:23,43-44,53,57-72]** — The two repos now disagree about the wire type of every money field. `Money`'s `PlainSerializer(lambda v: float(v), ...)` deliberately converts the stored `Decimal` to a plain JSON **number** on output — its own comment and the commit that introduced it (`d4f95da`) say this was done specifically so "the wire contract... is unchanged" for existing numeric consumers. Three days later, `1fd7e4e`'s commit message says "the backend now sends amount/balance/... as decimal strings, not JSON numbers," and `domain.ts` types every money field as `string`, with `money.ts` repeating the same claim in its own comment. No backend commit ever made that change (confirmed via `git log -- app/schemas/money.py`, which shows only the original `d4f95da` add). Nothing crashes today because `toDecimal()` happily accepts a JS `number`, but (a) the precision gain the new frontend decimal.js layer is supposed to provide is partly illusory — the float round-trip already happened server-side before the exact `Decimal` ever reached the client — and (b) the TS types now actively lie about the runtime shape, which will bite the first time someone trusts them literally (a `.trim()`/regex on a value typed `string`, a zod schema, codegen from these types). Fix: pick one side as ground truth and align the other — either change `Money`'s serializer to actually emit a string (`PlainSerializer(str, return_type=str, ...)`) so the frontend's types and intent become true, or correct `domain.ts`/`money.ts`'s types and comments back to `number` and accept that the float round-trip already bounds precision to what a double can hold (fine for any realistic 2-decimal amount, just not "exact" in the way the comments claim).
- **[fintrack-backend/app/utils/rate_limit.py + app/main.py:31-32 <-> fintrack/src/api/client.ts:19-33]** — `slowapi`'s default `_rate_limit_exceeded_handler` (registered in `main.py`) returns `{"error": "Rate limit exceeded: ..."}` on a 429 (confirmed in slowapi's `extension.py`), not `{"detail": ...}`. `extractErrorMessage` in `client.ts` only reads `error.response?.data?.detail`, so hitting the `/login` or `/forgot-password` rate limit shows the generic "Something went wrong" fallback instead of the actual rate-limit message — directly undercutting the UX of the rate-limiting fix from the last review. Fix: either add a custom slowapi exception handler that returns `{"detail": ...}` to match every other error response in the API, or have `extractErrorMessage` also check `error.response?.data?.error`.
- **[fintrack-backend/app/api/admin.py:9,12,18 <-> fintrack/src (no call site)]** — `/api/admin/health` and `/api/admin/stats` have no caller anywhere in the frontend repo. Expected and fine — this is an ops-only surface, not a frontend gap — noted only for completeness.

## Nits & style
- `app/config/init_db.py:63` and `app/services/admin_service.py:38` use bare `except Exception: pass` — not security-relevant in either spot (a one-time token-encryption backfill and a best-effort file-size lookup), but worth at least a log line so a systematically broken path doesn't go unnoticed.
- `ruff check .` on the backend reports 216 issues, almost all stylistic (71 `B008` — FastAPI's own `Depends()`-in-default-argument pattern, a false positive for this framework; 63 `UP045` old-style `Optional[...]`; 32 unsorted imports). Not worth sprint time; consider a ruff config that excludes `B008` for this codebase.
- `tests/test_oauth_state.py:79` unpacks `headers, user = auth_headers` and never uses `user` — prefix with `_user`.

## What looks good
- **IDOR discipline is consistent**: every transaction/account/budget/category lookup by path-param ID filters by `user_id == current_user.id` directly in the query (`transactions.py:219-222`, `accounts.py:50`, `budgets.py:50`, `categories.py:43`) rather than relying on a decorator alone — no counterexample found despite specifically hunting for one.
- **Money handling on the backend is genuinely solid for this class of app**: `NUMERIC(12,2)` columns throughout, a dedicated `Money` Pydantic type keeping `Decimal` internally, `ROUND_HALF_UP` quantization in budget-spend calculations, and every amount field has both a `gt=0` floor and an explicit ceiling (`MAX_TRANSACTION_AMOUNT`).
- **OTP/token hygiene**: `hmac.compare_digest` for OTP code and admin-key comparisons, OTP codes hashed at rest with per-code attempt tracking and single-use `consumed` flags, and pending (OTP-stage) tokens carry a distinct `purpose` claim checked in `verify_token` so they can't accidentally authenticate a real route.
- **`src/api/client.ts`** does proactive token refresh ahead of expiry with a single de-duped in-flight refresh promise, and `add-expense.tsx` generates its idempotency key once per screen mount (not per submit) so a retried submission dedupes server-side instead of double-inserting.

## Suggested next steps
1. Fix the accounts.tsx silent-zero-balance bug (P0) — small, isolated, high-impact.
2. Resolve the money-field wire-type disagreement between the two repos (pick string or number, make both sides actually match) before building anything else on top of the current `decimal.js` layer.
3. Add rate limiting to `/verify-otp`, `/resend-otp`, `/reset-password`, `/signup`.
4. Fix the slowapi 429 error envelope so rate-limit messages actually reach the user.
5. Stop swallowing the NUMERIC migration failure in `init_db.py`; fail loudly or flag it.
6. Address the web `localStorage` token storage given the web build is a real deployment target.
7. Everything else in Medium/Nits as time allows.
