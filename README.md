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

Login/signup accept either a **phone number or an email address** — a single "identifier" field is classified client-side (`src/utils/identifier.ts`) and validated accordingly. The login screen calls `/api/auth/login` and only offers to create an account if none exists for that identifier, so you can't accidentally end up with duplicate accounts for the same phone/email under different names.

Google OAuth (`src/hooks/useGoogleAuth.ts`) is wired up but not yet the primary flow — phone/email is the current default while Google sign-in is finished.

## Features

- **Transactions** — manual entry, filtering, categorized by type (debit/credit) and category (food, transport, rent, etc.)
- **Budgets** — per-category weekly/monthly limits vs. spend
- **Multi-source tracking** — transactions carry a `source` (`manual`, `gmail`, `sms`, `aa`) so future auto-import (starting with Gmail) slots in without changing the data model
