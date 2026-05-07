# OpenCare — Backend

Express 5 API server. Handles auth, AI conversations, file storage, and DB queries.

## Stack

- **Express 5** + TypeScript
- **Better Auth** — session-based auth, Google OAuth, email/password
- **PostgreSQL** (`pg`) with `pgvector` extension for semantic search
- **Google Gemini** (`@google/genai`) — primary LLM
- **Hugging Face** (`@huggingface/inference`) — embeddings
- **Tavily** — optional web search grounding
- **AWS S3 / MinIO** (`@aws-sdk/client-s3`) — file storage


## API Endpoints

| Method | Path | Description |
|---|---|---|
| `*` | `/api/auth/**` | Better Auth handlers (login, signup, OAuth, session) |
| `GET` | `/api/me` | Current user session |
| `GET` | `/api/user/stats` | `{ conversationCount, messageCount, memberSince }` |
| `GET/POST` | `/api/user/health-profile` | Patient health profile (upsert) |
| `GET` | `/api/ai/conversations` | List conversations `{ id, title, updated_at }` |
| `GET` | `/api/ai/conversations/:id` | Conversation with all messages |
| `POST` | `/api/ai/conversations` | Create conversation + stream AI reply |
| `POST` | `/api/ai/conversations/:id/messages` | Send message, stream AI reply |
| `DELETE` | `/api/ai/conversations/:id` | Delete conversation |
| `GET` | `/api/storage/upload-url` | Pre-signed MinIO upload URL |
| `GET` | `/api/storage/file/:key` | Pre-signed download URL |
| `GET` | `/api/db-schema` | Live PostgreSQL schema for ER diagram |

## Environment

See `.env.example` at the project root. Key variables:

| Variable | Description |
|---|---|
| `PORT` | Server port (default `8080`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret for session signing |
| `BETTER_AUTH_URL` | Public base URL of this server |
| `LLM_API_KEY` | Google Gemini API key |
| `HF_API_KEY` | Hugging Face API key (embeddings) |
| `TAVILY_API_KEY` | Tavily web search API key |
| `S3_URL` | MinIO / S3 endpoint URL |
| `ACCESS_KEY` | MinIO access key |
| `SECRET_ACCESS_KEY` | MinIO secret key |
| `S3_BUCKET_NAME` | Storage bucket name |
| `EXTERNAL_SERVER_URL` | Python redaction server URL |
| `EXTERNAL_SERVER_KEY` | Shared secret for python-server auth |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex key for encrypting sensitive data |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

## Run
This project is package agnostic (you can use any package manager you want)
ex: npm, pnpm, bun, yarn

```bash
npm install
npm run dev     # nodemon watch mode
npm run build   # tsc compile to dist/
npm run start   # run compiled dist/server.js
```

## Database Migrations

Migration files are in `db-migrations/`. To set up a fresh database:

```bash
psql <DATABASE_URL> -f db-migrations/generate-tables.sql
```