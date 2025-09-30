# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a TypeScript-based Model Context Protocol (MCP) server that integrates with the Tweek API. The project provides secure authentication, calendar management, task CRUD operations, and custom color handling through MCP tools. It's built as an ESM module using Node 20+ and PNPM.

## Development Commands

### Setup & Development
```bash
# Install dependencies
pnpm i

# Build the TypeScript code
pnpm build

# Start development server with auto-reload
pnpm dev

# Run the built server
pnpm start

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Authentication Setup
```bash
# Interactive sign-in (prompts for email/password)
pnpm auth:signin

# Import existing refresh token
pnpm auth:import
```

## Architecture & Structure

### Core Components

1. **Authentication Layer** (`src/auth/`)
   - `AuthManager`: Handles token caching, expiry tracking, and proactive refresh
   - `TokenStore`: Manages secure token persistence with optional AES-GCM encryption
   - `IdentityClient`: Handles credential exchange with Google Identity Platform

2. **Configuration** (`src/config/`)
   - Environment-based configuration with validation
   - Supports home directory path expansion (`~/.config/tweek/tokens.json`)

3. **MCP Server Core** (`src/index.ts`)
   - Entry point that bootstraps the MCP server
   - Routes MCP calls to domain services

### Key Design Patterns

- **Token Management**: Proactive refresh with configurable buffer window (default 60s)
- **Security First**: Credentials never persisted, tokens optionally encrypted at rest
- **Modular Architecture**: Clear separation between auth, config, HTTP client, and MCP tools
- **Error Mapping**: HTTP status codes mapped to structured MCP errors

### Environment Configuration

Required:
- `TWEEK_API_KEY`: Tweek API key for authentication

Optional with defaults:
- `TWEEK_API_BASE`: API base URL (default: `https://tweek.so/api`)
- `TWEEK_TOKENS_PATH`: Token storage path (default: `~/.config/tweek/tokens.json`)
- `TWEEK_REQUEST_TIMEOUT_MS`: HTTP timeout (default: `10000`)
- `TWEEK_TOKEN_REFRESH_BUFFER_SEC`: Token refresh buffer (default: `120`)
- `TWEEK_ENCRYPTION_KEY`: Optional 32-byte key for token encryption

## Development Guidelines

### TypeScript Configuration
- Uses ES2022 target with ESM modules
- Strict mode enabled with comprehensive type checking
- Output directory: `dist/`
- Module resolution: "Bundler"

### Testing Strategy
- Test files located in `src/tests/`
- Uses Vitest for test runner
- Tests cover auth components, config validation, and core functionality
- Focus on unit tests for validators, retry logic, and token management

### Code Style
- Uses `@antfu/eslint-config` for consistent formatting
- ESM imports/exports throughout
- Prefer explicit types over `any`
- Error handling with typed error classes

### Security Considerations
- Never log tokens or API keys - they are automatically redacted
- Token files created with 600 permissions
- Credentials only held in memory during sign-in flow
- Optional AES-GCM encryption for token storage

## MCP Tools Overview

The server exposes these MCP tools:
- `listCalendars()`: Returns calendars with mapped roles
- `listTasks()`: Paginated task listing with date filtering
- `getTask()`: Fetch individual task by ID
- `createTask()`: Create new task with validation
- `updateTask()`: Partial task updates
- `deleteTask()`: Remove task
- `getCustomColors()`: User's custom color palette

### Input Validation
- `freq` values must be integers 0-7 (Tweek recurrence enum)
- Date fields must be valid ISO 8601 format
- `calendarId` required and non-empty for task creation
- Checklist items must have non-empty `text` fields

## Common Development Patterns

### Adding New MCP Tools
1. Create tool implementation in `src/tools/`
2. Add input validation logic
3. Map HTTP errors to MCP error codes
4. Add comprehensive tests
5. Update type definitions

### Error Handling
- HTTP 401/403 → `UNAUTHENTICATED`
- HTTP 404 → `NOT_FOUND`
- HTTP 400 → `INVALID_ARGUMENT`
- HTTP 429 → `RESOURCE_EXHAUSTED`
- HTTP 5xx → `UNAVAILABLE`

### Authentication Flow
1. User runs `pnpm auth:signin` for initial setup
2. Credentials exchanged for tokens via Google Identity Platform
3. Tokens persisted locally with secure permissions
4. Server automatically refreshes tokens before expiry
5. All API calls include `Authorization: Bearer {idToken}` + `x-api-key`

## Dependencies & Toolchain

- **Runtime**: Node 20+, requires native `fetch` support
- **Package Manager**: PNPM 10+
- **Build**: TypeScript compiler, no bundling
- **Testing**: Vitest with Node environment
- **Linting**: ESLint with Antfu's configuration
- **Development**: tsx for TypeScript execution and watching

## First-Time Setup Flow

1. Clone repository and run `pnpm i`
2. Set `TWEEK_API_KEY` environment variable
3. Run `pnpm auth:signin` to authenticate and store tokens
4. Run `pnpm dev` to start development server
5. Server loads tokens automatically on subsequent runs
