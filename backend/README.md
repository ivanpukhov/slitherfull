# Slither backend

## Overview
The backend is a Node.js WebSocket server that manages the slither arena simulation and persists player accounts. Key components:

- **`src/server.js`** – bootstraps Express, REST auth routes and the WebSocket server, verifies JWT tokens before admitting players, and synchronises balances with the database.
- **`src/world.js`** – core game logic. Now tracks `userId` for each player, calls the account service to debit bets and credit cashouts, and prevents gameplay when the stored balance is zero.
- **`src/models/User.js`** – Sequelize model backed by SQLite. Stores email, bcrypt password hash, nickname and current balance (starting at 10).
- **`src/routes/auth.js`** – `/api/auth/register`, `/api/auth/login`, `/api/auth/me` endpoints returning JWT tokens for the client.

## Getting started
1. Copy `.env.example` from the repository root and adjust values if needed:
   - `PORT` – HTTP/WebSocket port (default `8080`).
   - `CLIENT_ORIGIN` – comma separated list of allowed origins for CORS.
   - `DATABASE_PATH` – SQLite file location (created automatically).
   - `JWT_SECRET` / `JWT_EXPIRES_IN` – token configuration.
2. Install dependencies and start the server:
   ```bash
   npm install
   npm start
   ```
   The server will run migrations automatically via `sequelize.sync()` – no manual migration step is required.

## Auth flow summary
- **Registration** (`POST /api/auth/register`): validates unique email & nickname, hashes the password, seeds the account with a balance of 10 and returns a JWT + user payload.
- **Login** (`POST /api/auth/login`): verifies credentials and returns a JWT + user payload.
- **Session check** (`GET /api/auth/me`): validates the bearer token and returns the current user/balance snapshot.

The WebSocket handshake requires a valid JWT (`token` field in the `join` message). When the balance is insufficient the server returns an `insufficient_balance` error and terminates the socket.

## Wallet, payouts and statistics
- **Game wallet** – the server provisions a Solana hot wallet (`GameWallet` model) used to escrow in-game bets. Player wallets are generated during registration and stored in the `users` table.
- **Transfers** –
  - `POST /api/wallet/withdraw` – moves the entire balance from a player's in-game wallet to any destination Solana address supplied by the user.
  - `POST /api/wallet/refresh` – refreshes the cached on-chain balance and persists it on the user record.
  - `POST /api/wallet/airdrop` – devnet helper that requests SOL airdrops for the authenticated player.
- **Payout logging** – every cashout is recorded in the `game_payouts` table (`GamePayout` model) together with SOL/USD amounts and transaction metadata.
- **Statistics** –
  - `GET /api/stats/leaderboard` – aggregates winnings for the last 24 hours, 7 days and 30 days (top 10 players per window) and normalises the result in USD using the latest price feed.
  - `GET /api/stats/me` – returns the authenticated user's payout history as a day-by-day time series for charting.

## Development tips
- Use the account service in `src/services/accountService.js` when persisting balance changes; it centralises all Sequelize access.
- The server logs fatal errors on startup – check the console output if Express or the WebSocket server fail to bind.
- Game-specific logging (kills, payouts, etc.) remains in `kills.log`, while cashout payouts are stored in SQLite for analytics.
