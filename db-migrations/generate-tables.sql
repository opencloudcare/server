-- OpenCare — full database schema
-- Run this on a fresh database to create all tables.
-- psql <DATABASE_URL> -f all.sql

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Better Auth core tables ─────────────────────────────────────────────────

CREATE TABLE "user" (
                        "id"            text        NOT NULL PRIMARY KEY,
                        "name"          text        NOT NULL,
                        "firstName"     text        NOT NULL DEFAULT '',
                        "lastName"      text        NOT NULL DEFAULT '',
                        "email"         text        NOT NULL UNIQUE,
                        "emailVerified" boolean     NOT NULL,
                        "image"         text,
                        "createdAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        "updatedAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "session" (
                           "id"        text        NOT NULL PRIMARY KEY,
                           "expiresAt" timestamptz NOT NULL,
                           "token"     text        NOT NULL UNIQUE,
                           "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                           "updatedAt" timestamptz NOT NULL,
                           "ipAddress" text,
                           "userAgent" text,
                           "userId"    text        NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
                           "id"                     text        NOT NULL PRIMARY KEY,
                           "accountId"              text        NOT NULL,
                           "providerId"             text        NOT NULL,
                           "userId"                 text        NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
                           "accessToken"            text,
                           "refreshToken"           text,
                           "idToken"                text,
                           "accessTokenExpiresAt"   timestamptz,
                           "refreshTokenExpiresAt"  timestamptz,
                           "scope"                  text,
                           "password"               text,
                           "createdAt"              timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                           "updatedAt"              timestamptz NOT NULL
);

CREATE TABLE "verification" (
                                "id"         text        NOT NULL PRIMARY KEY,
                                "identifier" text        NOT NULL,
                                "value"      text        NOT NULL,
                                "expiresAt"  timestamptz NOT NULL,
                                "createdAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                "updatedAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX session_userId_idx        ON "session"      ("userId");
CREATE INDEX account_userId_idx        ON "account"      ("userId");
CREATE INDEX verification_identifier_idx ON "verification" ("identifier");

-- ─── Conversations & messages ─────────────────────────────────────────────────

CREATE TABLE conversation (
                              id         text        PRIMARY KEY DEFAULT gen_random_uuid(),
                              user_id    text        NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
                              title      text,
                              created_at timestamptz DEFAULT now(),
                              updated_at timestamptz DEFAULT now()
);

CREATE TABLE message (
                         id              text        PRIMARY KEY DEFAULT gen_random_uuid(),
                         conversation_id text        NOT NULL REFERENCES conversation (id) ON DELETE CASCADE,
                         role            text        NOT NULL CHECK (role IN ('user', 'model')),
                         content         text        NOT NULL,
                         created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON message(conversation_id);
CREATE INDEX ON conversation(user_id);

CREATE TABLE message_file (
                              message_id text NOT NULL REFERENCES message (id),
                              file_key   text NOT NULL,
                              file_name  text NOT NULL,
                              file_type  text NOT NULL,
                              PRIMARY KEY (message_id, file_key)
);

-- ─── User preferences ─────────────────────────────────────────────────────────

CREATE TABLE user_preferences (
                                  id                         text    PRIMARY KEY DEFAULT gen_random_uuid(),
                                  user_id                    text    NOT NULL REFERENCES "user" (id),
                                  ai_model                   text    NOT NULL DEFAULT 'gemma-4-31b-it',
                                  enable_web_search_default  boolean NOT NULL DEFAULT false,
                                  detailed_responses         boolean NOT NULL DEFAULT false
);

-- ─── Encrypted hidden data ────────────────────────────────────────────────────

CREATE TABLE hidden_data (
                             id      text PRIMARY KEY DEFAULT gen_random_uuid(),
                             user_id text NOT NULL UNIQUE REFERENCES "user" (id),
                             data    text NOT NULL DEFAULT ''
);

-- ─── Web search cache (semantic) ─────────────────────────────────────────────

CREATE TABLE web_search (
                            id         text        PRIMARY KEY DEFAULT gen_random_uuid(),
                            query      text        NOT NULL,
                            results    text        NOT NULL,
                            embedding  vector(384),
                            created_at timestamptz DEFAULT now()
);

CREATE INDEX ON web_search USING hnsw (embedding vector_cosine_ops);

-- ─── Patient health profile ───────────────────────────────────────────────────

CREATE TABLE health_profile (
                                id            text         PRIMARY KEY DEFAULT gen_random_uuid(),
                                user_id       text         NOT NULL UNIQUE REFERENCES "user" (id) ON DELETE CASCADE,
                                date_of_birth date,
                                sex           text         CHECK (sex IN ('male', 'female', 'prefer_not_to_say')),
                                weight_kg     numeric(5,2),
                                height_cm     numeric(5,2),
                                blood_type    text         CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
                                conditions    text         NOT NULL DEFAULT '',
                                medications   text         NOT NULL DEFAULT '',
                                allergies     text         NOT NULL DEFAULT '',
                                updated_at    timestamptz  DEFAULT now()
);
