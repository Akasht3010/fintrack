# FinTrack

A unified personal expense tracker — see all your spending across apps and banks in one place. React Native (Expo) frontend, backed by [fintrack-backend](https://github.com/Akasht3010/fintrack-backend).

## Tech stack

- **Expo** + **Expo Router** — file-based navigation
- **TypeScript**
- **NativeWind** (Tailwind for React Native) — styling
- **Zustand** — state management
- **TanStack Query** + **Axios** — data fetching
- **expo-secure-store** — token storage
- **expo-auth-session** — Google OAuth (in progress)

## Getting started

```bash
npm install
npx expo start
```

Then press `i` for iOS simulator, `a` for Android, or scan the QR code with Expo Go on a physical device.

### Backend

This app needs [`fintrack-backend`](https://github.com/Akasht3010/fintrack-backend) running locally. By default the app auto-detects your machine's LAN IP from the Expo dev server (`src/config/env.ts`), so a physical device on the same Wi-Fi can reach it without any manual config. If that detection fails, set `extra.apiUrl` in `app.json`.

## Project structure

```
app/
  (auth)/         # login, signup
  (tabs)/         # home, transactions, budget, profile
  (modals)/       # add-expense, transaction-detail
src/
  api/            # axios client + typed endpoint calls
  store/          # Zustand stores (user, transactions)
  hooks/          # data-fetching + Google auth hooks
  components/     # ui, charts, shared, integrations
  types/          # shared domain types
  utils/          # currency, date, identifier helpers
```

## Auth

Three ways in, all issuing the same kind of backend JWT:

- **Log in** with a phone number or email — a single "identifier" field is classified client-side (`src/utils/identifier.ts`), calls `/api/auth/login`, and only offers to sign up if no account exists for that identifier.
- **Sign up** with name, a real email, and a phone number (all required) via `/api/auth/signup`. 409s with an "already exists" prompt if the email or phone is taken.
- **Continue with Google** (`src/hooks/useGoogleAuth.ts`) — backend-mediated OAuth (see the backend README's Google OAuth setup section for why: Expo Go's deep link changes every session, so Google can't redirect to it directly). Requires the backend to have real Google OAuth credentials and, for local testing, a tunnel like ngrok — until that's configured, this button will fail.

All authenticated requests send the token as `Authorization: Bearer <token>` (attached automatically by the axios client in `src/api/client.ts`); the backend derives the user from that token rather than trusting any client-supplied id.

## Features

- **Transactions** — manual entry, filtering, categorized by type (debit/credit) and category (food, transport, rent, etc.)
- **Budgets** — per-category weekly/monthly limits vs. spend
- **Multi-source tracking** — transactions carry a `source` (`manual`, `gmail`, `sms`, `aa`) so future auto-import (starting with Gmail) slots in without changing the data model
