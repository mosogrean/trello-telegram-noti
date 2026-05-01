# AGENT.md — AI-Generated Project Documentation

## About This Project

This project was designed and generated in full by **Claude Sonnet 4.6** (Anthropic), acting as an AI software engineer inside the **Claude Code** CLI tool (Claude Agent SDK environment). The user described the desired system in natural language, and Claude translated those requirements into a complete, production-ready codebase.

---

## Prompt Summary

The user requested:

> "Create a Node.js TypeScript and Docker Compose project that receives messages from Trello and sends them to Telegram bots. Include a React website to manage services, with a seeded username/password. When a Telegram bot is added, send a 6-digit OTP via the bot to verify it. Store all data in SQLite. Create README.md and AGENT.md."

---

## AI Decision Log

### Architecture Decisions

| Decision | Rationale |
|---|---|
| **Node.js + Express** | Lightweight, well-suited for webhook receivers and REST APIs |
| **TypeScript (strict mode)** | Type safety reduces runtime errors; better IDE support |
| **SQLite via `better-sqlite3`** | Zero-config persistence; synchronous API reduces async complexity; appropriate for this scale |
| **React + Vite** | User explicitly requested React for the frontend; Vite chosen for fast dev experience |
| **JWT authentication** | Stateless; works cleanly with React SPA without server-side session storage |
| **`node-telegram-bot-api`** | Mature library with good TypeScript types; polling=false since we only send messages |
| **Multi-stage Dockerfile** | Separates build from runtime; reduces final image size |
| **Docker named volume for SQLite** | Persists database across container restarts without bind-mount complexity |

### OTP Flow Design

The OTP verification serves as proof that:
1. The bot token is valid (it can call the Telegram API)
2. The provided chat ID is reachable by the bot
3. The admin controls the destination chat

Flow:
1. Admin adds bot (token + chat ID)
2. Service calls `bot.getMe()` to validate the token
3. Generates a 6-digit cryptographically random OTP using `crypto.randomInt()`
4. Stores OTP in `otp_verifications` table with a 10-minute expiry
5. Sends OTP via the bot to the chat ID
6. Admin enters OTP in the React dashboard
7. Service validates OTP (checks code, not expired, not used)
8. Bot is marked `verified = 1` in the database
9. Only verified bots can be linked to Trello boards

### Security Choices

- Passwords hashed with `bcrypt` (12 rounds)
- JWT tokens expire in 24 hours
- OTP codes expire in 10 minutes and are single-use
- `crypto.randomInt()` used for OTP generation (cryptographically secure)
- CORS restricted to Vite dev server origin in development; disabled in production
- SQLite WAL mode and `foreign_keys = ON` pragma enabled

### Trello Webhook Handling

- Trello requires the callback URL to respond to HEAD/GET for verification
- POST body contains `action` + `model`; the service looks up the board by `model.id`
- Notification sending is fire-and-forget (`Promise.allSettled`) — a single failing bot won't block others
- Response to Trello is sent immediately (200 OK) before async processing to avoid timeout

---

## Files Generated

| File | Description |
|---|---|
| `src/app.ts` | Express application entry point, serves React build in production |
| `src/config/database.ts` | SQLite connection, WAL mode, schema migration |
| `src/middleware/auth.ts` | JWT verification middleware + token generator |
| `src/routes/auth.ts` | Login / logout / /me endpoints |
| `src/routes/telegram.ts` | Bot CRUD + OTP trigger and verification |
| `src/routes/boards.ts` | Board CRUD + bot↔board link management |
| `src/routes/webhook.ts` | Trello webhook receiver (HEAD/GET/POST) |
| `src/services/telegramService.ts` | Telegram API wrapper (send message, get bot info, OTP message) |
| `src/services/trelloService.ts` | Trello API calls, action description formatter, webhook registration |
| `src/services/otpService.ts` | OTP generation, database persistence, verification logic |
| `src/seed/seed.ts` | Admin user seeder (runs once, idempotent) |
| `client/src/App.tsx` | React router with protected/public route guards |
| `client/src/context/AuthContext.tsx` | Auth state (token, login, logout) via React Context |
| `client/src/api/client.ts` | Typed fetch wrapper with auto-auth headers and 401 redirect |
| `client/src/pages/Login.tsx` | Login page with form validation |
| `client/src/pages/Bots.tsx` | Bot management: add, verify OTP, resend OTP, remove |
| `client/src/pages/Boards.tsx` | Board management: register, link/unlink bots, remove |
| `client/src/components/Navbar.tsx` | Top navigation bar with logout |
| `Dockerfile` | Multi-stage build: backend + frontend → production image |
| `docker-compose.yml` | Service definition with named volume and health check |
| `.env.example` | Template for environment configuration |
| `README.md` | User-facing install, setup, and usage documentation |
| `AGENT.md` | This file — AI design decisions and generation context |

---

## Model Information

- **Model**: Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- **Interface**: Claude Code CLI (Claude Agent SDK)
- **Date generated**: 2026-05-01
- **Anthropic**: [https://anthropic.com](https://anthropic.com)
- **Claude Code**: [https://claude.ai/code](https://claude.ai/code)

---

## Human Oversight

While this project was AI-generated, it is intended to be reviewed, tested, and maintained by human developers. The AI made reasonable design choices based on the stated requirements, but you should:

- Review all security-sensitive code (auth, OTP, token storage)
- Change default credentials before deploying
- Add rate limiting for production deployments
- Consider HTTPS termination (nginx reverse proxy) in production
- Run `npm audit` to check for known vulnerabilities before shipping
