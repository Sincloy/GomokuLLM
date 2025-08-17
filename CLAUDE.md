# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GomokuLLM is a modern TypeScript-based Gomoku (Five in a Row) game with multiple AI implementations and LLM integration. The project consists of a client-side game built with Vite and a Cloudflare Worker backend that serves static files and provides AI move calculations via LLM APIs.

## Essential Commands

### Development
- `npm run dev` - Start development server (runs on port 3000)
- `npm run build` - Build client-side TypeScript and bundle with Vite
- `npm run preview` - Preview the built application

### Testing
- `npm test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode

### Worker Deployment
- `npm run build:worker` - Build Cloudflare Worker
- `npm run deploy:worker` - Deploy worker to Cloudflare
- `npm run deploy` - Full deployment (build client + worker + deploy)

## Code Architecture

### Client-Side Architecture (`src/client/`)

**Game Logic (`src/client/game/`)**
- `types.ts` - Core type definitions, enums, and constants (CellState, Difficulty, AIType, GameState)
- `board.ts` - Board class handling game state, move validation, and win detection
- `game-controller.ts` - Main game controller coordinating between UI, board, and AI

**AI Implementations (`src/client/game/ai/`)**
- `local/simple.ts` - Local AI algorithms (easy/medium/hard difficulty)
- `api/llm-client.ts` - Client for communicating with worker's LLM API
- `api/prompt-templates.ts` - LLM prompt formatting utilities

**UI Layer (`src/client/ui/`)**
- `board-renderer.ts` - Canvas-based board rendering
- `ui-controller.ts` - UI event handling and game state display

### Worker Architecture (`src/worker/`)

**Main Worker (`src/worker/index.ts`)**
- Cloudflare Worker entry point handling HTTP requests
- API routing (`/api/move` for AI moves)
- Static file serving via ASSETS binding
- CORS handling for development

**AI Implementation (`src/worker/gomoku-ai.ts`)**
- Advanced AI algorithms for medium/hard difficulty
- Board analysis and move evaluation
- Strategic position scoring

### Key Architectural Patterns

1. **Separation of Concerns**: Game logic separated from UI and AI implementations
2. **Strategy Pattern**: Multiple AI implementations (local vs LLM) selected via AIType enum
3. **Client-Worker Architecture**: Client handles UI/basic logic, worker provides advanced AI via LLM APIs
4. **Fallback Strategy**: LLM client falls back to local AI if API calls fail

## LLM Integration

The project supports two LLM providers configured via environment variables:

**Anthropic Claude** (default)
- Uses `@anthropic-ai/sdk` with thinking mode support
- Configurable via `GOMOKU_AI_*` environment variables
- Supports custom base URLs (e.g., Cloudflare AI Gateway)

**OpenAI**
- Uses `openai` SDK
- Configurable via `GOMOKU_OPENAI_*` environment variables

**Key Environment Variables:**
- `GOMOKU_AI_PROVIDER` - "anthropic" or "openai"
- `GOMOKU_AI_API_KEY` / `GOMOKU_OPENAI_API_KEY` - API keys
- `GOMOKU_AI_MODEL` / `GOMOKU_OPENAI_MODEL` - Model selection
- `GOMOKU_AI_THINKING_ENABLED` - Enable Claude's thinking mode

## Configuration Files

- `vite.config.ts` - Vite build configuration with alias `@/` pointing to `src/`
- `wrangler.toml` - Cloudflare Worker configuration with asset binding
- `tsconfig.json` - TypeScript configuration for client code
- `tsconfig.worker.json` - Separate TypeScript configuration for worker code
- `tailwind.config.js` / `postcss.config.js` - CSS framework configuration

## Development Notes

### Working with Game Logic
- Board state is represented as 2D array with CellState enum values
- Coordinate system: (0,0) is top-left, (14,14) is bottom-right
- Game controller handles turn management and AI integration
- Always validate moves using `board.isValidMove()` before applying

### AI Development
- Local AI algorithms are in `src/client/game/ai/local/`
- LLM integration happens via worker API calls to `/api/move`
- Worker includes sophisticated board analysis and move scoring
- AI can "surrender" by returning move coordinates (-1, -1)

### Worker Development
- Worker code must be built separately with `npm run build:worker`
- Static assets are served via ASSETS binding in production
- Development mode redirects to localhost:3000
- API responses include CORS headers for cross-origin requests

### Environment Variables
Set worker environment variables using wrangler:
```bash
wrangler secret put GOMOKU_AI_API_KEY
```

## Testing Strategy

- Tests run with Vitest framework
- Use `npm test` for single run, `npm run test:watch` for development
- Test files should follow `*.test.ts` naming convention