# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Headline is a live music booking platform built with bare React Native (0.84.1) and TypeScript. It connects bands, venues, and visitors for show discovery, booking, and ticketing. Supports English and Swedish.

## Build & Development Commands

```bash
# Start Metro bundler
npm start

# Run on iOS/Android with environment config
npm run dev:ios          # development
npm run alpha:ios        # alpha/staging
npm run dev:android
npm run alpha:android

# Install iOS pods
npm run pods

# Lint & format
npm run lint
npm run prettier:write

# Run tests
npm run test
```

Environment files live in `.config/` (`.development.env`, `.alpha.env`, `.production.env`) and get copied to `.env` by the run scripts. Environment variables (`API_URL`, `MOCK_URL`, `GAPI_KEY`) are imported from `@env` via react-native-dotenv.

## Architecture

### Source Layout (`src/`)

- **`api/`** — Axios-based API layer. `Request.ts` is a custom wrapper that injects Firebase auth tokens, handles request cancellation, and sets locale headers. Each domain has its own file (`bands.ts`, `shows.ts`, etc.). Endpoints configured in `constants.ts`.
- **`features/`** — Redux Toolkit vertical slices. Each feature folder contains a slice, selectors, and async thunks (e.g., `features/bands/` has `bandsSlice.ts`, `bandsSelectors.ts`, `bandsActions.ts`).
- **`screens/`** — Page-level screen components wired to navigation routes.
- **`components/`** — Reusable UI components (GoBack, Icon, Spinner, Ticket, etc.).
- **`Generics/`** — Styled wrapper primitives (Page, Text, Image, Card).
- **`utils/`** — Pure utility functions (color, date, locale, location, string, url, platform).
- **`translations/`** — i18n JSON files (`en.json`, `sv.json`) used via i18n-js and a `useTranslation()` hook from `features/locale/`.
- **`app/`** — Redux store setup, root reducer, screen name constants, and `AppLoader.tsx` (initialization gate).

### State Management

Redux Toolkit with async thunks. Data is normalized using `normalizr` for shows/bands/venues. Pattern for async operations:
1. Thunk dispatches `{feature}Start` action
2. API call via `api/{feature}.ts`
3. Success dispatches normalized data; failure dispatches error via `errorToObject()`
4. Selectors denormalize for components

Store is configured in `app/store.ts` with Reactotron enhancer for debugging.

### Navigation

React Navigation v7 with a root stack containing a bottom tab navigator (Explore, Search, Map, Tickets, Profile). Each tab has its own nested stack. Profile tab conditionally shows auth or profile screens based on `shouldShowSignIn` state. Checkout/Completed screens are on the root stack. Screen name constants are in `app/constants.ts`.

### Authentication

Firebase Auth (email/password). `useFirebase()` hook in `features/firebase/` listens to `onAuthStateChanged` and syncs to Redux. Auth tokens are injected into every API request by `Request.ts`.

### Styling

styled-components/native with light/dark theme support. Theme colors are centralized in `utils/colorUtils.ts` with helper functions (`darken()`, `brighten()`, `rgba()`). Theme types defined in `styled.d.ts`.

### User Types

Three user types defined in `app/constants.ts`: visitor (1), band (2), venue (3). The active user type and associated entities are tracked in the `context` feature slice.

## Code Conventions

- Redux slices: `{feature}Slice.ts`, actions: verb-first (`authSignInStart`), selectors: `{feature}Selectors.ts`
- Async thunks: `request{Entity}{Action}` (e.g., `requestGetShows`, `requestCreateBand`)
- Prettier: no semicolons, single quotes, trailing commas (es5), 2-space indent
- TypeScript strict mode is OFF
- Node >=22.11.0 required
