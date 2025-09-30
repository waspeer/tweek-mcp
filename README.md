# Tweek MCP Server

A Model Context Protocol (MCP) server that integrates with the [Tweek API](https://tweek.so/calendar/api) to manage calendars, tasks, and custom colors. Built with TypeScript and ESM modules.

## Features

- **Secure Authentication**: Interactive sign-in with automatic token refresh
- **Calendar Management**: List calendars with role-based access
- **Task CRUD**: Create, read, update, and delete tasks with validation
- **Custom Colors**: Fetch user-specific color preferences
- **Pagination Support**: Forward-only pagination with `nextDocId`
- **Error Handling**: Structured error mapping with retry logic for transient failures
- **Token Security**: Encrypted token storage with file permissions (mode 600)

## Prerequisites

- Node 20+
- PNPM 10+
- Tweek API key (obtain from [Tweek](https://tweek.so/calendar/api))

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Quick Start

### 1. Configure Environment

Set your Tweek API key (required):

```bash
export TWEEK_API_KEY="your-api-key-here"
```

See [Configuration](#configuration) for all available environment variables.

### 2. First-Time Authentication

Before starting the server, you need to authenticate once:

```bash
pnpm auth:signin
```

You'll be prompted to enter your Tweek email and password:

```
Enter your Tweek email: user@example.com
Enter your Tweek password: ********
✅ Authentication successful! Tokens saved.
```

Your credentials are used only in memory and never persisted. The command exchanges them for tokens and securely saves them to `~/.tweek-mcp/tokens.json` (or your configured `TWEEK_TOKENS_PATH`).

#### Alternative Authentication Methods

**Non-interactive (for automation/CI):**

```bash
echo "your-password" | pnpm auth:signin --email user@example.com --password-stdin
```

**Import existing refresh token:**

```bash
pnpm auth:import --refresh-token "your-refresh-token"
```

### 3. Start the Server

```bash
pnpm start
```

The server will:
- Load tokens from the token file
- Automatically refresh the `idToken` if needed
- Start listening for MCP requests

**For development with auto-reload:**

```bash
pnpm dev
```

## Configuration

Configure via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWEEK_API_KEY` | ✅ Yes | - | Your Tweek API key |
| `TWEEK_API_BASE` | No | `https://tweek.so/api/v1` | Tweek API base URL |
| `TWEEK_TOKENS_PATH` | No | `~/.tweek-mcp/tokens.json` | Path to token storage file |
| `TWEEK_REQUEST_TIMEOUT_MS` | No | `30000` | HTTP request timeout (milliseconds) |
| `TWEEK_TOKEN_REFRESH_BUFFER_SEC` | No | `60` | Proactive token refresh window (seconds) |
| `TWEEK_ENCRYPTION_KEY` | No | - | 32-byte key for AES-GCM token encryption |

### Example Configuration

```bash
export TWEEK_API_KEY="ak_live_..."
export TWEEK_TOKENS_PATH="/secure/volume/tweek-tokens.json"
export TWEEK_ENCRYPTION_KEY="your-32-byte-encryption-key-here"
export TWEEK_REQUEST_TIMEOUT_MS="45000"
export TWEEK_TOKEN_REFRESH_BUFFER_SEC="120"
```

## MCP Tools

The server exposes the following MCP tools:

### Calendars

**`listCalendars()`**

List all calendars accessible to the authenticated user.

**Returns:**
```ts
interface ListCalendarsResponse {
  calendars: Calendar[]
}

interface Calendar {
  id: string
  name: string
  role: 'ROLE_OWNER' | 'ROLE_EDITOR' | 'ROLE_VIEWER'
  color?: string
  // ... other calendar fields
}
```

### Tasks

**`listTasks({ calendarId, startAt?, dateFrom?, dateTo? })`**

List tasks with optional pagination and date filtering.

**Parameters:**
- `calendarId` (required): Calendar ID
- `startAt` (optional): Pagination cursor from previous response
- `dateFrom` (optional): ISO 8601 date to filter tasks from
- `dateTo` (optional): ISO 8601 date to filter tasks to

**Returns:**
```ts
interface ListTasksResponse {
  pageSize: number
  nextDocId?: string
  data: Task[]
}
```

**`getTask({ taskId })`**

Retrieve a single task by ID.

**`createTask({ task })`**

Create a new task.

**Parameters:**
- `task.calendarId` (required): Calendar ID
- `task.text` (required): Task title
- `task.date` (optional): ISO 8601 date
- `task.freq` (optional): Recurrence frequency (0-7)
- `task.checklist` (optional): Array of checklist items
- ... [see Tweek API docs](https://tweek.so/calendar/api) for all fields

**Returns:**
```ts
interface CreateTaskResponse {
  id: string
}
```

**`updateTask({ taskId, patch })`**

Update an existing task.

**Returns:** Full updated task object

**`deleteTask({ taskId })`**

Delete a task.

**Returns:**
```ts
interface DeleteTaskResponse {
  success: true
}
```

### Custom Colors

**`getCustomColors()`**

Fetch custom colors for the authenticated user. The `userId` is automatically extracted from the `idToken`.

**Returns:**
```ts
interface GetCustomColorsResponse {
  colors: Color[]
}

interface Color {
  id: string
  hex: string
  name?: string
}
```

## Input Validation

The server validates task inputs:

- `freq`: Must be integer 0-7 (Tweek recurrence enum)
- `notifyAt`, `date`, `isoDate`, `dtStart`: Must be valid ISO 8601 date/datetime
- `calendarId`: Required non-empty string on creation
- `checklist`: Each item must have non-empty `text` field

## Connecting MCP Clients

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tweek": {
      "command": "node",
      "args": ["/path/to/tweek-mcp/dist/index.js"],
      "env": {
        "TWEEK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Other MCP Clients

The server uses standard MCP JSON-RPC over stdio. Configure your client to:
1. Run `node dist/index.js` (or `pnpm start`)
2. Pass `TWEEK_API_KEY` in environment
3. Ensure token file exists at configured path

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run linter
pnpm lint

# Build TypeScript
pnpm build

# Development mode (auto-reload)
pnpm dev
```

### Project Structure

```
src/
├── auth/           # Authentication (AuthManager, TokenStore, IdentityClient)
├── cli/            # CLI commands (auth signin/import)
├── config/         # Configuration loading
├── http/           # HTTP client with retry logic
├── logging/        # Structured logging
├── tests/          # Test suite
├── tools/          # MCP tools (calendars, tasks, colors, validation)
├── tweek/          # Tweek API client and types
└── index.ts        # Server bootstrap
```

## Troubleshooting

### Error: "Tweek tokens not found"

**Problem:** Server cannot find the token file.

**Solution:** Run authentication first:
```bash
pnpm auth:signin
```

### Error: "UNAUTHENTICATED"

**Problem:** Tokens are expired or invalid.

**Solution:** Re-authenticate:
```bash
pnpm auth:signin
```

### Error: "Permission denied" on token file

**Problem:** Token file permissions are incorrect.

**Solution:** The server automatically sets mode 600. If issues persist, manually fix:
```bash
chmod 600 ~/.tweek-mcp/tokens.json
```

### Tokens Not Refreshing

**Problem:** Token refresh fails silently.

**Solution:** Check logs for refresh errors. Verify your refresh token is still valid by re-authenticating.

### Connection Timeouts

**Problem:** Requests timing out to Tweek API.

**Solution:** Increase timeout:
```bash
export TWEEK_REQUEST_TIMEOUT_MS="60000"
```

### Container Deployments

For Docker or containerized environments:

1. Mount a persistent volume for tokens:
   ```bash
   docker run -v /secure/volume:/tokens \
     -e TWEEK_TOKENS_PATH=/tokens/tweek.json \
     -e TWEEK_API_KEY=your-key \
     tweek-mcp
   ```

2. Consider using `TWEEK_ENCRYPTION_KEY` for additional security

3. Pre-authenticate using `auth:import` with a refresh token

## Security

- Tokens stored with file permissions 600 (user-only access)
- Optional AES-GCM encryption for token file
- Credentials never logged or persisted
- Sensitive headers redacted from logs
- Automatic token refresh before expiry

## Testing

Comprehensive test suite with:
- Unit tests for validation, retry logic, encryption
- Integration tests for HTTP client and auth flows
- CLI end-to-end tests
- Contract tests for MCP tools

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/tests/validation.test.ts

# Run tests matching pattern
pnpm test -- -t "should validate task input"
```

## Contributing

1. Follow the existing code style (enforced by ESLint)
2. Add tests for new features
3. Ensure `pnpm lint` and `pnpm test` pass
4. Update documentation as needed

## License

MIT

## Resources

- [Tweek API Documentation](https://tweek.so/calendar/api)
- [Model Context Protocol](https://modelcontextprotocol.io)
