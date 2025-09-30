# Tweek MCP – Implementation Tasks

This file breaks the specs into discrete, trackable tasks with clear outcomes, dependencies, and resources. Use it as the execution plan and checklist for the initial release.

Resources

- Specs: `specs/design.md`, `specs/requirements.md`
- Tweek API docs: `https://tweek.so/calendar/api`

Milestones

1) Project scaffold and configuration
2) Auth stack (TokenStore, IdentityClient, AuthManager)
3) HTTP client, errors, retry
4) Tweek client (typed endpoints)
5) MCP tools (calendars, tasks, colors) + validation
6) CLI (auth signin/import)
7) Logging, security hardening
8) Tests (unit, integration, CLI E2E, contract)
9) Build scripts, packaging, ergonomics

---

## 1. Project scaffold and configuration

- Task: Initialize TypeScript ESM project with PNPM
  - Sub‑tasks
    - Create `package.json` with `"type": "module"`, scripts from design spec
    - Add dependencies: `typescript`, `tsx` (dev), `eslint` (dev), `vitest` (dev), optional `undici`
    - Create `tsconfig.json` per spec target and options
    - Create folder structure under `src/` as proposed
  - Outcome: Running `pnpm build` compiles; `pnpm dev` runs server stub
  - Dependencies: None
  - Resources: design.md (Tooling, Folder Structure)

- Task: Implement configuration loader `src/config/index.ts`
  - Sub‑tasks
    - Read env vars: `TWEEK_API_BASE` (default), `TWEEK_API_KEY` (required), `TWEEK_TOKENS_PATH` (default), `TWEEK_ENCRYPTION_KEY` (optional), `TWEEK_REQUEST_TIMEOUT_MS` (default), `TWEEK_TOKEN_REFRESH_BUFFER_SEC` (default)
    - Expand `~` in token path; ensure directories exist
    - Validate types and constraints; surface clear error if `TWEEK_API_KEY` missing
  - Outcome: Exported typed config usable by other modules
  - Dependencies: Project scaffold
  - Resources: design.md (Configuration and Defaults)

STATUS: COMPLETE

---

## 2. Authentication stack

- Task: Implement `TokenStore` (`src/auth/tokenStore.ts`)
  - Sub‑tasks
    - Define tokens model: `{ idToken, refreshToken, expiresAt }`
    - Read/write JSON to `TWEEK_TOKENS_PATH` with `0600` permissions
    - Optional AES‑GCM encryption when `TWEEK_ENCRYPTION_KEY` is present (versioned envelope with `{ nonce, ciphertext, tag }`)
    - Handle missing file with explicit error consumed by server bootstrap and CLI
  - Outcome: Reliable persistence of tokens at rest (encrypted when configured)
  - Dependencies: Config
  - Resources: design.md (Token Storage and Encryption)

- Task: Implement `IdentityClient` (`src/auth/identityClient.ts`)
  - Sub‑tasks
    - Exchange email/password for `{ idToken, refreshToken, expiresAt }`
    - Exchange `refreshToken` for new `{ idToken, expiresAt }`
    - Use API key in headers as required by Tweek Identity endpoints (per Tweek API)
  - Outcome: Minimal, typed client for credential and refresh flows
  - Dependencies: HTTP client
  - Resources: requirements.md (Authentication)

- Task: Implement `AuthManager` (`src/auth/authManager.ts`)
  - Sub‑tasks
    - In‑memory cache for tokens; track expiry
    - `initialize()` loads from `TokenStore`; proactive refresh if expiring within buffer
    - `getValidIdToken()` refreshes when needed using `refreshToken`
    - Persist updated tokens to `TokenStore` after refresh
  - Outcome: Single entry point for obtaining a valid `idToken`
  - Dependencies: TokenStore, IdentityClient, Config
  - Resources: design.md (Sequence Diagrams; Auth Subsystem)

STATUS: COMPLETED

---

## 3. HTTP client, errors, and retry

- Task: Implement `HttpClient` (`src/http/httpClient.ts`)
  - Sub‑tasks
    - Wrapper over Node 20 `fetch` (fallback to `undici` if needed)
    - Base URL, default headers (`x-api-key`), timeout via `AbortController`
    - Redact sensitive headers (`Authorization`, `x-api-key`) in logs
  - Outcome: Reusable, typed HTTP layer with timeouts
  - Dependencies: Config

- Task: Implement error mapping and retry (`src/http/errors.ts`, `src/http/retry.ts`)
  - Sub‑tasks
    - Map HTTP status → structured errors: UNAUTHENTICATED, NOT_FOUND, INVALID_ARGUMENT, RESOURCE_EXHAUSTED, UNAVAILABLE
    - Exponential backoff with jitter for idempotent GET/DELETE on 5xx
  - Outcome: Consistent error semantics and resilient idempotent requests
  - Dependencies: HttpClient

STATUS: COMPLETED

---

## 4. Tweek client (typed endpoints)

- Task: Implement `TweekClient` (`src/tweek/tweekClient.ts`)
  - Sub‑tasks
    - Methods: calendars, tasks CRUD, custom colors
    - Attach `Authorization: Bearer {idToken}` and `x-api-key`
    - Parse/return typed DTOs and surface `nextDocId` for pagination
  - Outcome: Thin, typed client encapsulating API details
  - Dependencies: HttpClient, AuthManager

- Task: Implement domain types and mappers (`src/tweek/types.ts`, `src/tweek/mappers.ts`)
  - Sub‑tasks
    - Stable enums for roles (`ROLE_OWNER`, `ROLE_EDITOR`, `ROLE_VIEWER`)
    - DTOs for tasks, calendars, custom colors, and list responses
    - Map Tweek responses → internal types
  - Outcome: Stable typing boundary for the server
  - Dependencies: None (parallel with client)

STATUS: COMPLETED

---

## 5. MCP tools and validation

- Task: Validation utilities (`src/tools/validation.ts`)
  - Sub‑tasks
    - `validateTaskInput` and `validateTaskPatch`
    - Rules: `freq` in [0..7]; ISO checks for `notifyAt`, `date`, `isoDate`, `dtStart`; `calendarId` required on create; checklist items require non‑empty `text`
  - Outcome: Centralized, reusable validation used by tools
  - Dependencies: Types

- Task: Calendars tool (`src/tools/calendarsTool.ts`)
  - Sub‑tasks
    - Expose `listCalendars()` via MCP
    - Map API roles → stable enum
  - Outcome: Returns `calendars[]`
  - Dependencies: TweekClient

- Task: Tasks tool (`src/tools/tasksTool.ts`)
  - Sub‑tasks
    - `listTasks({ calendarId, startAt?, dateFrom?, dateTo? })` → `{ pageSize, nextDocId, data }`
    - `getTask({ taskId })` → `task`
    - `createTask({ task })` → `{ id }` with validation
    - `updateTask({ taskId, patch })` → updated `task` with validation
    - `deleteTask({ taskId })` → `{ success: true }`
  - Outcome: Fully functional task management via MCP
  - Dependencies: TweekClient, Validation

- Task: Custom colors tool (`src/tools/colorsTool.ts`)
  - Sub‑tasks
    - Extract `userId` from `idToken` claims in `AuthManager`
    - `getCustomColors()` → `colors[]`
  - Outcome: Colors available to clients with no extra input
  - Dependencies: TweekClient, AuthManager

- Task: Server bootstrap (`src/index.ts`)
  - Sub‑tasks
    - Initialize Config, HttpClient, TokenStore, IdentityClient, AuthManager, TweekClient
    - Register tools with MCP server host
    - Startup behavior: error if tokens missing with actionable guidance
  - Outcome: `pnpm start` launches MCP server ready for calls
  - Dependencies: All previous tasks

STATUS: COMPLETED

---

## 6. CLI for auth provisioning

- Task: `auth signin` interactive (`src/cli/auth-signin.ts`)
  - Sub‑tasks
    - Prompt for email and hidden password; or flags `--email`, `--password-stdin`
    - Exchange credentials for tokens; write `TokenStore` and exit
    - Never persist or log credentials
  - Outcome: First‑time setup flow supported
  - Dependencies: IdentityClient, TokenStore, Config

- Task: `auth import` (`src/cli/auth-import.ts`)
  - Sub‑tasks
    - Accept `--refresh-token` argument; exchange for `idToken`
    - Persist tokens via `TokenStore`
  - Outcome: Automation/CI provisioning supported
  - Dependencies: IdentityClient, TokenStore

STATUS: COMPLETED

---

## 7. Logging and security

- Task: Structured logging
  - Sub‑tasks
    - Add contextual logs to HTTP (method, path, status, duration)
    - Redact `Authorization` and `x-api-key` headers from logs
  - Outcome: Useful, safe diagnostics
  - Dependencies: HttpClient

- Task: File permission enforcement
  - Sub‑tasks
    - Ensure `TokenStore` sets mode `0600` and verifies on read
  - Outcome: Tokens file is private to the user
  - Dependencies: TokenStore

STATUS: COMPLETED

---

## 8. Testing strategy

- Task: Unit tests
  - Sub‑tasks
    - Validation utilities (edge cases)
    - Retry/backoff logic
    - Token expiry and proactive refresh
    - Encryption/decryption round‑trip with deterministic vectors
  - Outcome: High confidence in core logic
  - Dependencies: Implemented modules

- Task: Integration tests
  - Sub‑tasks
    - TweekClient against mock server (calendar, tasks CRUD, colors)
    - AuthManager + TokenStore lifecycle
  - Outcome: Behavior verified across layers
  - Dependencies: Client, Auth

- Task: CLI E2E tests
  - Sub‑tasks
    - Spawn `auth signin` with mocked stdin; assert tokens written with mode 600
    - `auth import` with test refresh token path
  - Outcome: Provisioning flows validated
  - Dependencies: CLI, TokenStore

- Task: Contract tests for MCP tools
  - Sub‑tasks
    - Golden I/O for tool calls (`listCalendars`, tasks CRUD, `getCustomColors`)
    - Error mapping assertions for typical HTTP errors
  - Outcome: Stable MCP surface
  - Dependencies: Tools

STATUS: COMPLETED

---

## 9. Build, scripts, and developer ergonomics

- Task: NPM scripts per spec
  - Sub‑tasks
    - `build`, `start`, `dev`, `auth:signin`, `auth:import`, `lint`, `test`
  - Outcome: Consistent DX across local and CI
  - Dependencies: Scaffold

- Task: README and quickstart
  - Sub‑tasks
    - Minimal README: config, first‑time `auth signin`, running server
  - Outcome: Discoverable setup for new users
  - Dependencies: CLI, Bootstrap

STATUS: COMPLETED
