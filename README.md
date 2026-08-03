# Nova — AI Customer-Support Agent

An agentic customer-support system. Users chat with an AI agent through a live chat widget; the agent (a LangGraph graph over Groq/llama-3.3-70b or Gemini) decides when to call tools, executes real backend logic, and hands off to a human when the issue needs a person.

**Live demo:** [ai-support-agent-rho.vercel.app](https://ai-support-agent-rho.vercel.app)

---

## Highlights

- **Agentic tool use, not canned responses** — the LLM plans tool calls, the backend executes them with real logic:
  - `get_order_status` — order lookup scoped to the **authenticated user** (JWT identity injected into the tool; the model never guesses who you are).
  - `faq_lookup` — semantic knowledge-base search over **pgvector** (`ORDER BY embedding <=> query LIMIT 5`).
  - `escalate_to_human` — creates a support ticket and hands the live chat to a human agent.
- **Security-first scoping** — 1 order → direct answer, multiple → the agent lists them and asks which one, zero → it says so. No cross-user data leakage.
- **Polyglot persistence**:
  - **PostgreSQL (Neon)** via Prisma — users, orders, tickets, and pgvector FAQ embeddings.
  - **MongoDB Atlas** via Mongoose — chat transcripts/session lifecycle, plus analytics computed with a single `$facet` aggregation pipeline.
  - **Upstash Redis** — session presence state and rate limiting.
- **Human-in-the-loop** — live support dashboard with transcripts, escalation feed, and analytics; escalation is idempotent (no duplicate tickets).
- **Production hardened** — fixes malformed LLM tool calls (Groq returns `arguments: "null"` on optional-only schemas, which silently kills tool execution) via a normalizing model wrapper; Docker + auto-deploy + health checks on Postgres/Mongo/Redis.

## Architecture

```
Browser (Next.js 14 + Socket.IO client)
        │  REST (auth)            WSS (chat)
        ▼                            ▼
NestJS API ──► JWT Auth guard ──► Chat Gateway (Socket.IO)
        │                            │
        ├── LangGraph agent ─────────┤ emits tool_start / tool_call events
        │      ├─ get_order_status   └─► Prisma (PostgreSQL)
        │      ├─ faq_lookup            └─ pgvector top-5 ANN
        │      └─ escalate_to_human     └─ Ticket (Postgres) + session flip
        │
        ├── Mongoose ──► MongoDB Atlas (chat transcripts, analytics)
        └── Upstash Redis (presence state, rate limits)
```

## Tech Stack

| Layer      | Tech                                                                  |
| ---------- | --------------------------------------------------------------------- |
| Backend    | NestJS 11, Socket.IO, LangGraph, LangChain, Groq / Gemini, Passport-JWT |
| Frontend   | Next.js 14 (App Router), React 18, Tailwind CSS, Socket.IO client      |
| Databases  | PostgreSQL (Neon + Prisma + pgvector), MongoDB Atlas (Mongoose), Upstash Redis |
| Infra      | Docker, Render (backend), Vercel (frontend), Cloud Run (cloudbuild.yaml) |

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL (pgvector extension enabled) — e.g. Neon
- MongoDB Atlas
- Upstash Redis
- A Groq API key (or a Google AI API key for Gemini)

### 1. Backend

```bash
cd backend
npm ci
cp .env.example .env   # fill in your keys
npx prisma migrate deploy
npm run seed
npm run start:dev      # http://localhost:3001
```

Environment variables (see `.env.example`):

```
DATABASE_URL          # PostgreSQL (Neon) connection string
MONGODB_URI           # MongoDB Atlas connection string
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
LLM_PROVIDER          # groq | google
LLM_MODEL             # llama-3.3-70b-versatile | gemini-2.0-flash
GROQ_API_KEY / GOOGLE_API_KEY
EMBEDDINGS_MODEL      # text-embedding-004 (768 dims, matches pgvector column)
JWT_SECRET / JWT_EXPIRES_IN
PORT / CORS_ORIGIN
```

### 2. Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local   # point NEXT_PUBLIC_* at the backend
npm run dev                  # http://localhost:3000
```

### 3. Seed data

`npm run seed` (in `backend/`) creates 5 users (password `password123`) and 20 embedded FAQ entries:

| Email                | Role          | Notes                    |
| -------------------- | ------------- | ------------------------ |
| `demo@stellar.dev`   | customer      | 10 orders (multiple)     |
| `one@stellar.dev`    | customer      | 1 order                  |
| `none@stellar.dev`   | customer      | 0 orders                 |
| `support@stellar.dev`| support_agent | dashboard                 |
| `admin@stellar.dev`  | admin         | dashboard                 |

## Demo Flow

1. Open the chat widget and ask **"Where is my order?"** — the agent lists your orders and asks which one (it never asks for personal data).
2. Reply **"The Silk Sleep Mask one, ORD-1003"** — it returns exact status, date, and total.
3. Ask a policy question (e.g. **"What is your return policy?"**) — `faq_lookup` answers from the knowledge base.
4. Ask **"I want a refund"** — the agent escalates and creates a ticket; view it live in the **/dashboard** (`admin@stellar.dev`).

## Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run build`         | Compile (SWC)                            |
| `npm run start:prod`    | Run compiled `dist/main.js`              |
| `npm run typecheck`     | `tsc --noEmit`                           |
| `npm run prisma:migrate`| Apply migrations (`prisma migrate dev`)  |
| `npm run seed`          | Seed users, orders, and FAQ embeddings   |

## Deployment

- **Backend:** Docker image (`backend/Dockerfile`) deployed to Render with auto-deploy and a `/api/health` check (validates Postgres, Mongo, and Redis). `cloudbuild.yaml` provides an equivalent Cloud Run path (512 MiB, auto-scaling to 5 instances).
- **Frontend:** `frontend` deployed to Vercel (production alias).
- **DB migrations:** run automatically at container boot (`npx prisma migrate deploy`).

## Project Structure

```
backend/
  prisma/            # schema, migrations, seed
  src/
    agent/           # LangGraph agent + tools (order-status, faq-search, escalate)
    chat/            # Socket.IO gateway, WS JWT guard, Mongo session schema
    sessions/        # session lifecycle + escalation (Mongo + Redis + Postgres ticket)
    analytics/       # $facet aggregation over chat-sessions
    auth/            # JWT auth (register/login, guards, roles)
    embeddings/      # Gemini embeddings → pgvector
    redis/           # Upstash Redis service + rate limiting
frontend/
  app/               # Next.js routes (landing, chat, dashboard, login, register)
  components/        # ChatWidget, dashboard panels, Nova brand mark
  lib/               # api client, socket client, types
```
