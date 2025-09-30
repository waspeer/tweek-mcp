# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based MCP (Model Context Protocol) server that integrates with the Tweek API to provide calendar and task management capabilities. The server handles authentication via Google Identity Platform, manages tokens with automatic refresh, and exposes Tweek's calendars, tasks, and custom colors through MCP tools.

## Development Commands

- **Build**: `pnpm build` - Compiles TypeScript to `dist/` directory
- **Development**: `pnpm dev` - Runs the server in watch mode using tsx
- **Start**: `pnpm start` - Runs the compiled server from dist/
- **Linting**: `pnpm lint` - Runs ESLint with @antfu/eslint-config
- **Authentication Setup**:
  - `pnpm auth:signin` - Interactive authentication setup
  - `pnpm auth:import` - Import existing refresh token

## Architecture

The codebase follows a modular ESM TypeScript architecture:

- **Authentication Layer** (`src/auth/`): Manages token lifecycle, storage with optional encryption, and credential exchange via Google Identity Platform
- **HTTP Client** (`src/http/`): Wrapper around Node.js fetch with timeout, retry logic, and automatic redaction of sensitive headers (Authorization, x-api-key)
- **Configuration** (`src/config/`): Environment-based configuration with validation and path expansion
- **CLI Tools** (`src/cli/`): Authentication provisioning commands for initial setup
- **Tests** (`src/tests/`): Comprehensive unit and integration tests using Vitest

### Key Features
- Automatic token refresh with configurable buffer window
- Secure token storage with optional AES-GCM encryption
- HTTP retry logic for idempotent operations
- Comprehensive error mapping from HTTP to MCP error codes
- Sensitive data redaction in logs and traces

## Environment Configuration

**Required:**
- `TWEEK_API_KEY` - API key for Tweek service

**Optional (with defaults):**
- `TWEEK_API_BASE` (default: `https://tweek.so/api`)
- `TWEEK_TOKENS_PATH` (default: `~/.config/tweek/tokens.json`)
- `TWEEK_REQUEST_TIMEOUT_MS` (default: `10000`)
- `TWEEK_TOKEN_REFRESH_BUFFER_SEC` (default: `120`)
- `TWEEK_ENCRYPTION_KEY` (optional: 32-byte key for token encryption)

## Testing Strategy

The project uses Vitest for testing with comprehensive coverage:
- Unit tests for all core components (AuthManager, TokenStore, HttpClient)
- Integration tests for HTTP client functionality
- Mock-based testing with deterministic time handling
- Test configuration includes automatic mock restoration and clearing

**Test Execution:**
- **MCP Server**: Use the Vitest MCP server for running tests (preferred method)
- **Command Line**: `pnpm test` - Runs the full test suite with Vitest
- **Individual Files**: `pnpm test <test-name>` - Run specific test files

**Note**: When available, prefer using the Vitest MCP server for interactive test execution and debugging.

## Specification Documentation

For detailed requirements and architecture information, refer to:
- `specs/requirements.md` - Complete functional requirements, user stories, and API specifications
- `specs/design.md` - Technical architecture, component diagrams, sequence flows, and implementation details
- `specs/tasks.md` - Development task breakdown and implementation roadmap

These specifications provide the complete context for understanding the project's goals, technical decisions, and implementation patterns.
