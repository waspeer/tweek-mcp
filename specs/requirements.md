# Tweek MCP Server – Requirements (v3)

This document defines the requirements for a Model Context Protocol (MCP) server that integrates with the Tweek API to manage calendars, tasks, and user colors.

Reference: [Tweek API – Developer Guide](https://tweek.so/calendar/api)

## Goals

- Provide a secure, configurable MCP server that exposes Tweek capabilities (calendars, tasks, custom colors) as MCP tools/resources.
- Handle authentication against Google Identity Platform using Tweek’s API key and user credentials or refresh token, including automatic token refresh.
- Support reliable CRUD for tasks, listing calendars, paginated task retrieval with date filtering, and fetching custom colors.
- Enforce good DX: clear errors, typed inputs/outputs, and consistent response shapes.

## Non‑Goals

- Implementing a UI or CLI beyond what’s necessary to verify the server.
- Managing Tweek accounts or quotas; we rely on Tweek for these.
- Sync with other providers beyond what Tweek exposes.

## Assumptions

- A valid Tweek API key is available in runtime configuration.
- Users can provide email/password interactively to obtain tokens, or provide a long‑lived refresh token.
- The MCP host can store secrets securely (environment variables or host‑provided vault).

---

## Functional Requirements

### Authentication

- The server must authenticate using Google Identity Platform per Tweek docs.
- The server must use `Authorization: Bearer {idToken}` for all Tweek API calls to `https://tweek.so/api/v1`.
- The server must automatically refresh the `idToken` using the `refreshToken` when it is about to expire (buffer window configurable, default 60 seconds).
- Tokens must be cached in memory and persisted to the local filesystem to be reused across server restarts.

#### First-Time Setup and Authentication Workflow

The server is designed for a simple and secure one-time setup process that does not require storing credentials in environment variables.

1. **Initial Run Attempt:** A user runs `npx tweek-mcp`. The server checks for a token file at `TWEEK_TOKENS_PATH`. If the file does not exist, the server will not start and will instead print a clear message instructing the user to authenticate.

    ```bash
    Error: Tweek tokens not found. Please run the one-time setup command:
    $ npx tweek-mcp auth signin
    ```

2. **Interactive Sign-In:** The user runs the interactive `auth signin` command. The tool prompts for an email and password, with password input hidden for security.

    ```bash
    $ npx tweek-mcp auth signin
    Enter your Tweek email: user@example.com
    Enter your Tweek password: ********
    ```

3. **Secure Token Exchange:** The command takes the credentials (held only in memory), exchanges them for a long-lived `refreshToken` and a short-lived `idToken`, and securely writes **only the tokens** to the `TWEEK_TOKENS_PATH` file.
4. **Credentials Discarded:** The command then exits, and the user's email and password are immediately discarded. They are never logged or persisted to disk.
5. **Subsequent Runs:** The user can now run `npx tweek-mcp` successfully. The server will load the tokens from the file and handle all future token refreshes automatically.

#### Credential Provisioning Commands

- The server must provide secure commands for the initial authentication and token provisioning:
  - **Interactive CLI:** `tweek-mcp auth signin` prompts for email and password (password input hidden), exchanges for tokens, writes a tokens file, and discards credentials.
  - **Non-interactive (for automation):** `tweek-mcp auth signin --email <email> --password-stdin` reads the password from standard input. This prevents credentials from appearing in process lists or shell history.
  - **Manual Provisioning:** `tweek-mcp auth import --refresh-token <token>` allows a user to import an existing `refreshToken`, which is then exchanged for an `idToken` and persisted.

### Calendars

- Provide a tool to list calendars: GET `/calendars`.
- Map roles to a stable enum: `ROLE_OWNER`, `ROLE_EDITOR`, `ROLE_VIEWER`.

### Tasks

- Provide tools for tasks:
  - List tasks (paginated): GET `/tasks?calendarId={calendarId}[&startAt={nextDocId}][&dateFrom={iso}][&dateTo={iso}]`.
  - Get a task by id: GET `/tasks/{taskId}`.
  - Create task: POST `/tasks`.
  - Update task: PATCH `/tasks/{taskId}`.
  - Delete task: DELETE `/tasks/{taskId}`.

#### Input Validation for Tasks

- The server must perform validation on task creation and updates for the following fields:
  - `freq`: If provided, must be a valid Tweek-recurrents enum value (0-7).
  - `notifyAt`, `date`, `isoDate`, `dtStart`: If provided, must be valid ISO 8601 date or datetime strings.
  - `calendarId`: Must be a non-empty string on creation.
  - `checklist`: Each item must contain a non-empty `text` field.

### Custom Colors

- Provide a tool to fetch custom colors for the authenticated user. The server must automatically extract the `userId` from the `idToken` claims.
- API Call: GET `/custom-colors/{userId}`.

### Configuration

- Configuration via environment variables and/or a config file:
  - `TWEEK_API_BASE` (optional; default `https://tweek.so/api/v1`).
  - `TWEEK_API_KEY` (required).
  - `TWEEK_TOKENS_PATH` (optional; path to persisted tokens file, default `~/.tweek-mcp/tokens.json`).
  - `TWEEK_ENCRYPTION_KEY` (optional; a 32-byte key to encrypt the tokens file at rest).
  - `TWEEK_REQUEST_TIMEOUT_MS` (optional; default 30000).
  - `TWEEK_TOKEN_REFRESH_BUFFER_SEC` (optional; default 60).

### MCP Tools/Methods

- Expose MCP operations with clear, typed, and consistent signatures:
  - `listCalendars()` → returns `calendars[]`.
  - `listTasks({ calendarId, startAt?, dateFrom?, dateTo? })` → returns `{ pageSize, nextDocId, data }`.
  - `getTask({ taskId })` → returns `task`.
  - `createTask({ task })` → returns `{ id }`.
  - `updateTask({ taskId, patch })` → returns the full, updated `task` object.
  - `deleteTask({ taskId })` → returns `{ success: true }`.
  - `getCustomColors()` → returns `colors[]`.

### Error Handling

- Translate HTTP errors to structured MCP errors (e.g., `UNAUTHENTICATED`, `NOT_FOUND`).
- Retry idempotent GET/DELETE on 5xx errors with exponential backoff.

### Pagination & Filtering

- Surface `nextDocId` from the API for forward-only pagination.
- **Note:** The Tweek API does not provide a total item count. Clients should use "Load More" patterns instead of numbered pagination.

### Security

- Never log tokens or API keys. Redact sensitive headers in traces.
- Persist tokens to `TWEEK_TOKENS_PATH` with file permissions 600.
- User credentials (email/password) must only be handled in memory during interactive sign-in and never be persisted.
- If `TWEEK_ENCRYPTION_KEY` is provided, the tokens file must be encrypted at rest using AES-GCM.

#### Deployment Considerations

- The default `TWEEK_TOKENS_PATH` is for local use. For containerized deployments, this path should be overridden to point to a persistent, secure volume.

---

## User Stories with Acceptance Criteria

### Story 1: Authenticate via interactive sign-in

As an operator, I want to sign in interactively so that I can securely obtain tokens without persisting my credentials.

Acceptance criteria:

- Given a user runs `tweek-mcp auth signin`, they are prompted for an email and a hidden password.
- With valid credentials, the command exchanges them for an `idToken` and `refreshToken`.
- The tokens are written to `TWEEK_TOKENS_PATH` and the command exits.
- On subsequent server starts, the tokens are read and used automatically.
- On invalid credentials, the command surfaces an `UNAUTHENTICATED` error and does not create a token file.

(Other user stories remain unchanged but now align with the refined authentication and tool definitions.)
