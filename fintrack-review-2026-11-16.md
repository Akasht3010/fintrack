# Fintrack Weekly Code Review - 2026-11-16

## Summary
Both repos were available and reviewed in full: `fintrack` (frontend, SHA `8a37d4c9d34bf445a51304b3212c502b29e55a84`) and `fintrack-backend` (SHA `0dd0ce4a66645cc14f42570fef2e1518ee99d7de`) — both unchanged since the last two review cycles (same SHAs as PRs #10 and #11). The backend is unusually security-mature for a fintech app this size — the recent commit history shows a deliberate, well-documented campaign against IDOR, OAuth redirect forgery, OTP timing/TOCTOU races, and float money math, and this review's independent read of the code confirms those fixes actually hold (every transaction/account/budget/category route filters by `user_id`, OAuth state is server-bound with a strict redirect allowlist, OTP attempts/consumption use atomic conditional updates). **The headline concern carries over unfixed from PRs #9, #10, and #11: logout does not clear the React Query cache, and most query keys are not scoped by user id, so a shared device can render the previous user's financial data after a login switch.** Beyond that repeat P0, no new P1s were found. The other concerns are narrower: a couple of backend log lines that could leak exception detail from a token-bearing request, a frontend write-path convention violation (money sent as JSON numbers instead of the documented decimal-string wire format — verified *not* to cause actual precision loss, but inconsistent with the app's own stated contract and worth closing defensively), and a few accessibility/idempotency gaps on screens the earlier hardening commits didn't reach. Static analysis tooling could only partially run: backend `ruff` ran cleanly (style-only findings), but backend `mypy`/`pytest --collect-only` and all frontend tooling (`lint`/`typecheck`/`npm audit`) could not run because dependencies are not installed in this review container — this is a review-environment gap, not a code finding, and CI (configured in both repos' `.github/workflows`) remains the real source of truth for those checks. **Separately: PRs #5 through #11 from prior weekly reviews are all still open and unmerged — this backlog of 7 (now 8, with this PR) unreviewed weekly reports should get attention before another cycle piles on.**

## Critical (P0) - fix before deploy
- **[fintrack/app/(tabs)/profile.tsx:49]**, **[fintrack/src/store/useUserStore.ts:25-43]**, **[fintrack/app/_layout.tsx:26]** — Still unfixed; first reported in PR #9, repeated in PR #10 and #11. `handleLogout` calls `logout()` then `router.replace("/(auth)/login")`; `logout()` clears the local token/user record but never touches the TanStack Query cache (no `queryClient.clear()`/`removeQueries()`/`resetQueries()` anywhere in the codebase). Independently confirmed this review cycle that most query keys are also not scoped by user id: `["accounts", ...]` (`src/hooks/useAccounts.ts:7`), `["net-worth"]` (`useAccounts.ts:14`), `["categories", ...]` (`src/hooks/useCategories.ts:10`), `["budgets"]` (`app/(tabs)/budget.tsx:31`), `["insights"]` and `["recurring"]` (`app/(tabs)/insights.tsx:27,32`) carry no user identifier. Only `["transactions", user?.id, ...]` (`app/(tabs)/index.tsx:65`, `app/(tabs)/transactions.tsx:58`) is scoped, and even that cache entry is never evicted on logout — it's just orphaned, not cleared.
  Why it matters: on any shared or handed-down device (the realistic case for a family finance app), User A logs out, User B logs in, and TanStack Query serves User B the in-memory cached accounts/net-worth/budgets/insights/recurring/categories data belonging to User A instantly on mount, before the background refetch resolves — a direct cross-user financial-data and PII leak, not a theoretical one.
  Fix:
  ```ts
  // src/store/useUserStore.ts — give logout access to the QueryClient and
  // clear it as the very last step, after local state is already cleared
  // (clearing never blocks logout even if something above threw).
  import { QueryClient } from "@tanstack/react-query"

  export const configureUserStoreQueryClient = (qc: QueryClient) => { queryClient = qc }
  let queryClient: QueryClient | undefined

  // ...inside logout(), after set({ user: null, ... }):
  await queryClient?.clear()
  ```
  and scope every remaining query key by `user?.id` (`["accounts", user?.id, { includeArchived }]`, etc.) as defense in depth, so a cache that somehow survives a logout still can't leak across users.

## High (P1) - fix this sprint
None found.

## Medium (P2) - worth doing
- **[fintrack-backend/app/api/auth.py:502]** and **[fintrack-backend/app/api/gmail.py:111]** — `except Exception as e: print(f"...: {e}")` on a Gmail-token-revoke call whose request includes the refresh token as a query param (`app/services/gmail_service.py:45`).
  Why it matters: some `httpx` exception types embed the request URL (including query params) in their string representation. Printing `str(e)` on that specific call path risks writing a refresh token into stdout/logs, which this app is otherwise careful to avoid (the sibling exchange/sync paths at `gmail.py:86` and `gmail.py:147` already log correctly without this risk).
  Fix:
  ```python
  logger.exception("Gmail revoke failed for user_id=%s", user_id)
  ```
  not `print(f"...: {e}")`. Apply at both call sites.

- **[fintrack/src/api/endpoints/transactions.ts:5,21]**, **[fintrack/src/api/endpoints/budgets.ts:4,21]**, **[fintrack/src/api/endpoints/accounts.ts:16-20]** <-> **[fintrack-backend/app/schemas/money.py]** — Every money *write* (`amount`, `limit_amount`, `opening_balance`) is sent as a JSON `number`, while `src/utils/money.ts:3-9` documents the app-wide convention as "decimal string over the wire," and every money *read* (`Transaction.amount`, `Budget.limit_amount`, etc.) already comes back as a string.
  Why it matters: this was tested end-to-end during this review (Pydantic v2.13 + the `Money` Decimal field) and confirmed **not** to cause precision loss today — Pydantic converts a JSON float via its exact shortest-round-trip decimal representation (`19.99` → `Decimal('19.99')`, and a value like `19.999` is correctly rejected with a 422, not silently truncated). So this is not an active bug. But it is a real contract asymmetry: the write path depends on an implementation detail of Pydantic's float-to-Decimal coercion rather than the explicit string contract the rest of the app relies on, and it's the exact bug class two earlier backend commits (`9883dba`, `c9c9a7a`) were written to eliminate. A future serializer change, a different JSON parser, or a client that sends an amount from a locale-formatted number (not through `parseMoneyInput`) could reintroduce it.
  Fix: serialize all money fields as strings on write too, e.g. `amount: String(parsedAmount)`, matching the read contract and removing the dependency on Pydantic's coercion behavior.

- **[fintrack/app/(auth)/login.tsx, signup.tsx, forgot-password.tsx, reset-password.tsx, verify-otp.tsx]** — No `accessibilityLabel`/`accessibilityRole` on any input in the `(auth)` route group; commit `ed37be0` added this only to modals/add-expense/accounts/categories/budget screens.
  Why it matters: password and OTP entry are exactly the kind of critical input the earlier commit's own stated goal was to cover, and a screen-reader user cannot reliably log in, sign up, or recover their account.
  Fix: extend the same labeling pattern used in `add-expense.tsx` to all five `(auth)` screens.

- **[fintrack/app/(modals)/add-budget.tsx, accounts.tsx]** <-> **[fintrack-backend/app/schemas/budget.py, account.py]** — Budget and account creation have no `idempotency_key` equivalent to the one added for transactions (`794c030`-era pattern; backend enforces it via a `(user_id, idempotency_key)` unique index returning 409, `app/api/transactions.py:124-131`).
  Why it matters: a slow response that the client retries, or a double-tap that races past the `disabled={isSubmitting}` UI guard (which blocks a second render-cycle submit but not a second in-flight request issued before the first resolves), can create a duplicate budget or account. Lower severity than transactions since these aren't ledger entries, but same root cause and same fix is already proven in this codebase.
  Fix: reuse the transaction idempotency-key pattern (frontend-generated key + backend unique index + 409-is-success handling) for budget and account creation.

## Cross-repo contract issues
- **[fintrack/src/utils/money.ts:3-9 <-> fintrack-backend/app/schemas/money.py]** — See the P2 money-serialization item above; filed here too since it's fundamentally a frontend/backend contract mismatch (write-as-number vs. the documented/read-as-string convention), even though it doesn't currently break anything.
- No other contract drift found. Verified and clean:
  - Full endpoint-vs-call diff across auth, transactions, accounts, budgets, categories, insights, recurring, gmail, sms: every frontend call target exists on the backend with matching method, and every field name matches exactly (snake_case end-to-end on both sides, no serialization-layer drift).
  - Pagination (`page`, `limit`) and filter param names (`category`, `q`, `date_from`, `date_to`, `min_amount`, `max_amount`, `source`, `type`) are identical between `fintrack/src/api/endpoints/transactions.ts` and `fintrack-backend/app/api/transactions.py:137-212`.
  - `/api/insights?months=` (`fintrack/src/api/endpoints/insights.ts:5-8` <-> `fintrack-backend/app/api/insights.py:19`) and `/api/transactions/export` filters (`fintrack/src/api/endpoints/transactions.ts:95-102` <-> `fintrack-backend/app/api/transactions.py:167-178`) match exactly, including the CSV export's `responseType: "text"` on the frontend matching the backend's `text/csv` `StreamingResponse`.
  - Error envelope is uniformly `{"detail": ...}` on the backend (including the rate-limit handler at `fintrack-backend/app/main.py:34-41`, which was deliberately normalized to this shape per its own comment) and is read consistently via `extractErrorMessage` on the frontend (`fintrack/src/api/client.ts:32`).
  - OAuth redirect handling: the frontend's dynamic `app_redirect_uri` (`fintrack/src/hooks/useGoogleAuth.ts:46-60`) is validated backend-side against a strict allowlist (`fintrack-backend/app/utils/redirect_validation.py:20-47`) before being bound into server-side OAuth state — exact scheme/path/origin match only, no open redirect.
  - Web session transport: frontend's cookie-vs-bearer switch (`fintrack/src/utils/session.ts`) matches the backend's dual auth dependency (bearer header or `HttpOnly` cookie, `fintrack-backend/app/api/auth.py`) with no path where a bearer token is written to `localStorage` on web.

## Nits & style
- `fintrack-backend`: 222 `ruff` findings in `app/` — mostly `UP045` (`Optional[X]` → `X | None`, 67 hits) and `I001` (import sorting, 36 hits); zero security-relevant rule hits. Safe to `ruff check --fix .`.
- `fintrack-backend/app/api/auth.py`, `app/api/gmail.py`, `app/config/init_db.py` — use `print()` for startup/ops messages instead of `logging`; cosmetic, no correctness impact outside the two P2 sites above.
- `fintrack/src/api/client.ts:2`, `useGoogleAuth.ts:5`, `src/store/useUserStore.ts:2` — `import { storage as SecureStore } from "@/utils/storage"` aliases the platform-aware storage wrapper as `SecureStore`, which misleadingly implies native secure storage is always used (it correctly falls back to `localStorage` on web, per `src/utils/storage.ts:4-7`). Rename the alias to `storage`.
- `fintrack/__tests__/` — only `add-expense.smoke.test.tsx` and `login.smoke.test.tsx` exist; no smoke coverage for signup, OTP verification, forgot/reset-password, or account/budget creation.
- `fintrack-backend/tests/` — good targeted coverage (`test_money_precision.py`, `test_route_concurrency.py`, `test_rate_limit_*.py`), but static analysis in this review environment couldn't confirm current pass/fail status since dependencies aren't installed here; rely on CI for that signal this week.

## What looks good
- Backend authorization is uniformly correct: every transaction/account/budget/category read/write filters by `user_id == current_user.id` before 404ing otherwise, with no exceptions found and no route trusting a client-supplied user id — this is the single most common serious bug class in personal-finance apps, and it's closed everywhere.
- Money is `Decimal`/`NUMERIC(12,2)` end-to-end on the backend, serialized as a JSON string (not a float) with an explicit, tested migration off an earlier `FLOAT` schema and bounds that are documented as deliberate defensive ceilings rather than arbitrary limits.
- OTP handling closes a real TOCTOU race: both attempt-counting and single-use consumption use conditional `UPDATE ... WHERE` statements instead of read-then-write, and login/forgot-password responses are enumeration-safe (identical response shape plus a constant-time dummy-hash compare for unknown identifiers).
- The frontend's web session migration off `localStorage` is actually complete, not just claimed in the commit message: every `access_token` write site was traced and none fires when `usesCookieSession` is true, and `useUserStore.logout()` performs real server-side session invalidation (token_version bump) rather than a local-only token wipe — the token itself is handled correctly on logout; it's the separate React Query cache (see P0 above) that isn't.

## Suggested next steps
1. Fix the React Query cache/user-scoping P0 above — it's been open for three review cycles now and is a real cross-user data leak on shared devices.
2. Fix the two `print(str(e))` log sites in `fintrack-backend/app/api/auth.py:502` and `app/api/gmail.py:111` (small, isolated, no deploy risk).
3. Serialize money fields as strings on the frontend's write paths (`transactions.ts`, `budgets.ts`, `accounts.ts`) to match the documented wire contract.
4. Add `accessibilityLabel`/`accessibilityRole` to the five `(auth)` screens.
5. Extend the transaction idempotency-key pattern to budget and account creation.
6. Add smoke tests for signup/OTP/password-reset flows in `fintrack/__tests__/`.
7. Run `ruff check --fix .` in `fintrack-backend` for the style-only findings.
8. Clear the backlog: PRs #5–#11 (prior weekly reviews) are still open and unmerged — triage or close them so findings don't get lost in the pile-up.
