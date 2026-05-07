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

### Global

| Method | Path | Description |
|---|---|---|
| `ALL` | `/api/auth/**` | Better Auth handlers (login, signup, OAuth callback, session, sign-out) |
| `GET` | `/health` | Server liveness check — returns `{ status: "ok" }` |
| `POST` | `/auth/check_email` | Returns existing user rows for a given email (used by sign-in flow) |
| `GET` | `/api/me` | Returns the current session and user object |

### `/api/user`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/user/update/email` | Update the authenticated user's email (credential accounts only) |
| `GET` | `/api/user/ai_preferences` | Get AI preferences `{ ai_model, enable_web_search_default, detailed_responses }` |
| `POST` | `/api/user/ai_preferences` | Update AI preferences |
| `DELETE` | `/api/user/conversations/all` | Delete all conversations for the current user |
| `GET` | `/api/user/connections/:id` | List OAuth providers linked to a user account |
| `GET` | `/api/user/hidden-data` | Get decrypted redaction terms list |
| `POST` | `/api/user/hidden-data` | Encrypt and save redaction terms |
| `GET` | `/api/user/health-profile` | Get health profile; returns `null` if not yet created |
| `POST` | `/api/user/health-profile` | Upsert health profile (DOB, sex, weight, height, blood type, conditions, medications, allergies) |
| `GET` | `/api/user/stats` | Returns `{ conversationCount, messageCount, memberSince }` |

### `/api/ai`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ai/ask` | Stream an AI reply — accepts message history, model, file keys, health profile flag, web search flag |
| `POST` | `/api/ai/get-chat-title` | Generate a short conversation title from the first message |
| `POST` | `/api/ai/conversations` | Create a new conversation row |
| `GET` | `/api/ai/conversations` | List all conversations `{ id, title, updated_at }` ordered by most recent |
| `GET` | `/api/ai/conversations/:id` | Get all messages (with attached files) for a conversation |
| `POST` | `/api/ai/conversations/:id/title` | Update the title of a conversation |
| `DELETE` | `/api/ai/conversations/:id` | Delete a conversation and its messages |

### `/api/storage`

| Method | Path | Description |
|---|---|---|
| `PUT` | `/api/storage/upload` | Redact file via python-server then upload to MinIO (up to 50 MB; PDF, images, plain text supported) |
| `GET` | `/api/storage/list/:userId` | List all S3 objects under a user's prefix |
| `GET` | `/api/storage/get?key=` | Get a pre-signed download URL for a file key |
| `DELETE` | `/api/storage/delete/:key` | Delete a file from MinIO |
| `POST` | `/api/storage/folder` | Create an empty folder in MinIO |
| `POST` | `/api/storage/move` | Move a file (copy to new key, delete original) |

### `/api/db-schema`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/db-schema` | Returns full live schema: tables, columns (PK/FK/unique flags), foreign keys (with ON DELETE/UPDATE actions), indexes, and check constraints |

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