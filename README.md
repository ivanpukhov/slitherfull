# slitherfull

## Overview
slitherfull is a two-part implementation of a multiplayer slither-style arena:

- **backend** – a Node.js WebSocket server that manages the world simulation, user accounts, bets and payouts.
- **frontend** – a Vite + React client that renders the arena, connects via WebSocket and now provides email/password authentication.

## New gameplay & account flow
- Players must **register or sign in** with an email, password and unique nickname. Authentication uses JWT tokens stored in `localStorage` on the client.
- Each newly registered account receives **10 coins** on balance. A positive balance is required to start the game and place a bet.
- Bets are withdrawn from the account when the round starts. If a player cashes out successfully the winnings are added back to the persistent balance stored in SQLite.
- Nicknames are bound to the account and are prefilled (and locked) in the lobby UI after signing in.

## Running locally

### 1. Environment variables
Copy `.env.example` to `.env` and adjust values if required. The same file lists API and WebSocket endpoints consumed by the frontend.

### 2. Backend
```bash
cd backend
npm install
npm start
```
The server loads configuration from `.env`, syncs the SQLite schema (no migrations required) and exposes:
- REST endpoints under `/api/auth` for register/login/me.
- A WebSocket endpoint for the game loop (`ws://localhost:8080` by default).

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
The Vite dev server consumes the API/WS URLs from the `.env` file and renders the updated authentication modal on the lobby screen.

## Repository structure
```
.
├── backend/    # Node.js WebSocket server, REST auth API, Sequelize models
├── frontend/   # Vite + React client with game UI and auth modal
├── .env.example
└── README.md
```

Refer to the `backend/README.md` and `frontend/README.md` files for component-level notes and future contributor guidance.
