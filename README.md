# Trello Telegram Notification

A self-hosted service that forwards Trello board activity to Telegram bots, with a React web dashboard for management.

## Features

- Receive Trello board events via webhook and forward them to Telegram chats
- Manage multiple Telegram bots and Trello boards from a single dashboard
- OTP verification when adding a Telegram bot (bot sends a 6-digit code to the chat)
- JWT-authenticated web UI built with React + TypeScript
- SQLite database — no external database required
- Docker Compose deployment in one command

---

## How It Works

```
Trello Board → Webhook → This Service → Telegram Bot → Chat/Group
```

1. You register a Trello board (board ID + API credentials)
2. You add a Telegram bot (token + chat ID) — the bot sends a 6-digit OTP to verify
3. You link one or more verified bots to a board
4. When any activity happens on the board (card created, moved, commented, etc.), the service forwards it to all linked Telegram chats

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) + Docker Compose (for containerized deployment)

### Option A — Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourname/trello-telegram-noti.git
   cd trello-telegram-noti
   ```

2. **Create the environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** — set at minimum:
   ```env
   JWT_SECRET=a-very-long-random-string-here
   SESSION_SECRET=another-long-random-string
   APP_BASE_URL=https://yourdomain.com   # must be publicly reachable for Trello webhooks
   SEED_ADMIN_USERNAME=admin
   SEED_ADMIN_PASSWORD=yourpassword
   ```

4. **Build and start**
   ```bash
   docker compose up -d --build
   ```

5. **Seed the admin user** (first run only)
   ```bash
   docker compose exec app node dist/seed/seed.js
   ```

6. **Open the dashboard** at `http://localhost:3000`

---

### Option B — Local Development

1. **Install dependencies**
   ```bash
   # Backend
   npm install

   # Frontend
   cd client && npm install && cd ..
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Seed the admin user**
   ```bash
   npm run seed
   ```

4. **Start the backend**
   ```bash
   npm run dev
   ```

5. **Start the frontend** (in another terminal)
   ```bash
   cd client && npm run dev
   ```

6. **Open** `http://localhost:5173`

---

## Setup Guide

### Step 1 — Get Trello API Credentials

1. Go to [https://trello.com/app-key](https://trello.com/app-key)
2. Copy your **API Key**
3. Click **"Token"** link on that page and authorize to get your **Token**
4. Find your **Board ID** from the board URL:
   - URL: `https://trello.com/b/BOARD_ID/board-name`
   - Copy the `BOARD_ID` segment

### Step 2 — Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** (format: `123456:ABC-DEF...`)
4. Add the bot to your Telegram group/channel
5. Get the **chat ID**:
   - For a group: add `@userinfobot` to the group, it will display the chat ID
   - For a channel: the chat ID starts with `-100` followed by digits
   - For a private chat: message the bot and visit `https://api.telegram.org/bot<TOKEN>/getUpdates`

### Step 3 — Add a Bot in the Dashboard

1. Log in at `http://localhost:3000`
2. Go to **Telegram Bots** → **Add New Bot**
3. Fill in:
   - **Name**: a display label (e.g. "Dev Team Channel")
   - **Bot Token**: from @BotFather
   - **Chat ID**: the Telegram chat or group ID
4. Click **Add Bot & Send OTP**
5. The bot will send a **6-digit OTP** to the specified chat
6. Enter the OTP in the dashboard to verify the bot

### Step 4 — Register a Trello Board

1. Go to **Trello Boards** → **Register Trello Board**
2. Enter:
   - **Board ID**: from the Trello URL
   - **Trello API Key** and **Token**
3. Click **Register Board**
4. The service automatically registers a Trello webhook

> **Important**: Trello webhooks require your server to be publicly accessible. Use a domain name or a tunnel like [ngrok](https://ngrok.com/) for local testing.

### Step 5 — Link Bots to Boards

1. On the **Trello Boards** page, find your registered board
2. Under **Linked Telegram Bots**, click **Link** next to the verified bot
3. Done — activity on that board will now be forwarded to the bot's chat

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on |
| `NODE_ENV` | `development` | `production` or `development` |
| `JWT_SECRET` | *(required)* | Secret key for signing JWT tokens |
| `SESSION_SECRET` | *(required)* | Secret for session middleware |
| `DB_PATH` | `./data/database.sqlite` | Path to the SQLite database file |
| `SEED_ADMIN_USERNAME` | `admin` | Username for the seeded admin account |
| `SEED_ADMIN_PASSWORD` | `admin123` | Password for the seeded admin account |
| `APP_BASE_URL` | `http://localhost:3000` | Public URL used to register Trello webhooks |

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Login, returns JWT token |
| `GET` | `/api/auth/me` | Yes | Get current user info |
| `GET` | `/api/bots` | Yes | List all Telegram bots |
| `POST` | `/api/bots` | Yes | Add a bot (triggers OTP send) |
| `POST` | `/api/bots/:id/verify` | Yes | Verify bot with OTP |
| `POST` | `/api/bots/:id/resend-otp` | Yes | Resend OTP to bot chat |
| `DELETE` | `/api/bots/:id` | Yes | Remove a bot |
| `GET` | `/api/boards` | Yes | List all Trello boards |
| `POST` | `/api/boards` | Yes | Register a board + webhook |
| `DELETE` | `/api/boards/:id` | Yes | Remove a board + webhook |
| `GET` | `/api/boards/:id/bots` | Yes | List bots linked to a board |
| `POST` | `/api/boards/:boardId/bots/:botId` | Yes | Link a bot to a board |
| `DELETE` | `/api/boards/:boardId/bots/:botId` | Yes | Unlink a bot from a board |
| `POST` | `/api/webhook/trello` | No | Trello webhook receiver |

---

## Project Structure

```
trello-telegram-noti/
├── src/                        # Backend (Node.js + TypeScript)
│   ├── app.ts                  # Express entry point
│   ├── config/
│   │   └── database.ts         # SQLite setup & schema
│   ├── middleware/
│   │   └── auth.ts             # JWT middleware
│   ├── routes/
│   │   ├── auth.ts             # Login/logout
│   │   ├── boards.ts           # Trello board management
│   │   ├── telegram.ts         # Telegram bot management + OTP
│   │   └── webhook.ts          # Trello webhook receiver
│   ├── services/
│   │   ├── telegramService.ts  # Telegram API wrapper
│   │   ├── trelloService.ts    # Trello API + action formatter
│   │   └── otpService.ts       # OTP generation & verification
│   └── seed/
│       └── seed.ts             # Admin user seed script
├── client/                     # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── api/client.ts       # Fetch wrapper
│   │   ├── context/AuthContext.tsx
│   │   ├── components/Navbar.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Bots.tsx
│   │   │   └── Boards.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── data/                       # SQLite database (auto-created, gitignored)
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Local Tunnel for Development

To test Trello webhooks locally, use [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Then set `APP_BASE_URL` in your `.env` to the ngrok HTTPS URL (e.g. `https://abcd1234.ngrok.io`) and restart the server.

---

## License

MIT
