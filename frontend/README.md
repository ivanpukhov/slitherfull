# Slither frontend

## Overview
This package contains the Vite + React client for the slither arena. It now includes a modal-based authentication flow, persistent nicknames and balance-aware UI states.

## Key pieces
- **`src/components/AuthModal.tsx`** – handles login/registration inside a modal on the lobby screen.
- **`src/hooks/useAuth.ts`** – manages JWT storage, session refresh (`/api/auth/me`) and exposes helpers for the rest of the app.
- **`src/hooks/useConnection.ts`** – attaches the JWT to the `join` WebSocket payload and reacts to auth-related error codes.
- **`src/components/NicknameScreen.tsx`** – nickname field is now auto-filled/locked for authenticated users and start button is disabled when the balance is zero.

## Development
```bash
npm install
npm run dev
```
The dev server reads API/WS endpoints from the root `.env` file (`VITE_API_BASE_URL`, `VITE_WS_URL`). Tokens are stored in `localStorage` under `slither_token`.

## UX notes
- If the token becomes invalid the connection hook logs the user out and reopens the auth modal.
- Successful cashouts trigger a `cashout_confirmed` event which updates both the in-game HUD and the persisted balance via the backend.
- Users with insufficient balance cannot start a new match; the lobby explains the reason below the start button.

## Настройка фона сот
- Раскраска гексагонального поля задаётся в `src/utils/hexTheme.ts`. Там собраны все цвета и градиенты, которые использует `buildHexPattern` в хуке `useCanvas`.
- Чтобы поменять фон, скорректируйте значения в объекте `HEX_PATTERN_THEME` (например, замените цвета градиентов или цвет обводки).
- После сохранения изменений перезапускать dev-сервер не нужно — фон обновится при перерисовке канваса.
