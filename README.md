# FinTrack

A unified personal expense tracker — see all your spending across apps and banks in one place. React Native (Expo) frontend, backed by [fintrack-backend](https://github.com/Akasht3010/fintrack-backend).

Expo SDK 57 / React Native 0.86 / React 19.2. Ships as a native app (EAS) and, via `expo export -p web`, as a static web build deployed on Cloudflare Workers.

## Tech stack

- **Expo** + **Expo Router** — file-based navigation, typed routes
- **TypeScript** (strict)
- **NativeWind** (Tailwind for React Native) — styling, with a JS `useIsDesktop` breakpoint hook for layout that can't be a className
- **Zustand** — client state (user, transactions, theme)
- **TanStack Query** + **Axios** — server state / data fetching
- **expo-secure-store** — access-token storage
- **expo-web-browser** + **expo-linking** — backend-mediated Google & Gmail OAuth
- **expo-notifications** — local bill reminders
- **sms-reader** — a local native module (`modules/sms-reader/`, Android-only, iOS/web stubs) that reads bank-alert SMS from the device inbox

## Getting started

```bash
npm install
npm start          # expo start --go --lan
```

Then press `i` for iOS simulator, `a` for Android, or scan the QR code with Expo Go on a physical device. The SMS-reader module and Gmail deep-link callback need a dev client / production build (`npm run ios` / `npm run android`), not Expo Go.

Other scripts: `npm run web`, `npm run start:tunnel`, `npm run deploy` (web export → `wrangler deploy`), `npm run update:preview` / `update:production` (EAS Update).

### Backend

The app always talks to the deployed backend through the Cloudflare Worker proxy — `extra.apiUrl` in `app.json`, currently `https://fintrack-api-proxy.fintrack-proxy.workers.dev` (see [`fintrack-proxy`](https://github.com/Akasht3010/fintrack-proxy) for why the proxy exists). `src/config/env.ts` reads that value; there's no LAN-IP auto-detection. To point at a local [`fintrack-backend`](https://github.com/Akasht3010/fintrack-backend), change `extra.apiUrl` to your machine's LAN URL (e.g. `http://192.168.x.x:8000`).

## Project structure

```
app/
  (auth)/            # login, signup, verify-otp, forgot-password, reset-password
  (tabs)/            # home (index), transactions, budget, insights, profile
  (modals)/          # add-expense, add-budget, transaction-detail, accounts,
                     #   categories, recurring, export, edit-profile,
                     #   delete-account
  auth-callback.tsx  # Google sign-in deep-link landing
  gmail-callback.tsx # Gmail-connect deep-link landing
  _layout.tsx        # auth gate, font/theme load, query client, bill reminders
src/
  api/               # axios client + typed endpoint modules (auth, transactions,
                     #   budgets, categories, accounts, insights, recurring,
                     #   gmail, sms)
  config/            # env.ts — reads app.json `extra`
  constants/         # categories, colors, currencies, global.css
  store/             # Zustand stores — user, transactions, theme
  hooks/             # data fetching, Google/Gmail auth, Gmail auto-sync,
                     #   SMS sync, bill reminders, CSV export, filters
  components/shared/  # GlassCard, GlowBackground, Sidebar, Chip, EmptyState, …
  types/             # shared domain + API types
  utils/             # currency, date/date-ranges, identifier, notifications,
                     #   storage, budget alerts, confirm
modules/sms-reader/  # local native module (Android SMS inbox read)
```

## Auth

Three ways in, all ending with the same backend access token:

- **Log in** with a phone number or email — one "identifier" field, classified client-side (`src/utils/identifier.ts`). `/api/auth/login` checks the password and emails a 6-digit OTP; the `verify-otp` screen exchanges the code for the real token. A 404 offers to sign up instead.
- **Sign up** with name, email, phone, and a password (all required) via `/api/auth/signup` — returns a token straight away, no OTP. 409s with an "already exists" prompt if the email or phone is taken.
- **Continue with Google** (`src/hooks/useGoogleAuth.ts`) — backend-mediated OAuth: `expo-web-browser` opens the backend's `/api/auth/google/authorize`, and the backend redirects back to `fintrack://auth-callback` (handled by `app/auth-callback.tsx`) with a token. See the backend README's Google OAuth setup for why the redirect can't go straight to the app. Needs real Google credentials on the backend (and a tunnel for local dev), or the button fails.

**Forgot password** (`forgot-password` → `reset-password`) runs the same OTP flow and also lets a Google-only account set a password for the first time.

The access token is kept in `expo-secure-store` and attached as `Authorization: Bearer <token>` by the axios client (`src/api/client.ts`). There's no refresh flow — any 401/403 clears the session and drops to login (with a "Session expired" alert only if a live session was cut).

## Features

- **Transactions** — manual entry, edit, delete; search + filter by category / date / amount / type; each typed debit or credit
- **Categories** — built-in defaults plus custom ones (`(modals)/categories`), scoped to expense or income
- **Budgets** — per-category weekly/monthly limits vs. live spend, with local over-budget alerts
- **Accounts** — bank / cash / credit-card / wallet / investment, live balances, and a net-worth view
- **Insights** — monthly spend vs. income, category breakdown, top merchants
- **Recurring** — detected subscriptions/bills with a next-due date, plus local bill reminders via `expo-notifications`
- **Gmail import** — connect Gmail and auto-sync bank-alert emails into transactions on app foreground (`useGmailAutoSync`)
- **SMS import** — Android only; reads bank-alert SMS from the inbox and posts them to the backend (`useSmsSync`)
- **Multi-currency** — transactions carry their own currency; cross-currency totals are converted server-side
- **CSV export** — filtered transactions to a shareable file (`(modals)/export`)
- **Light / dark theme** — follows system by default, toggleable, persisted (`useThemeStore`)
- **Desktop web layout** — sidebar nav and centered content above the `md` breakpoint

Transactions carry a `source` (`manual`, `gmail`, `sms`, `aa`) tracking where they originated.
