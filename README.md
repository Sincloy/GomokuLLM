# GomokuLLM - Modern Gomoku Game with AI Integration

A modern implementation of the classic Gomoku (Five in a Row) game with local AI algorithms and LLM API integration.

## Features

- Modern UI built with TypeScript and Tailwind CSS
- Multiple AI difficulty levels
- Local AI algorithms (Simple strategy, with plans for MiniMax, NegaMax, Alpha-Beta pruning)
- LLM API integration for advanced AI gameplay
- Responsive design that works on desktop and mobile
- Cloudflare Workers deployment for serverless hosting

## Project Structure

```
GomokuLLM/
├── src/
│   ├── client/                 # Client-side code
│   │   ├── game/               # Game logic
│   │   │   ├── ai/             # AI implementations
│   │   │   │   ├── local/      # Local AI algorithms
│   │   │   │   └── api/        # API-based AI
│   │   │   ├── board.ts        # Board representation
│   │   │   ├── game-controller.ts # Game controller
│   │   │   └── types.ts        # Type definitions
│   │   ├── ui/                 # UI components
│   │   ├── styles/             # CSS styles
│   │   └── index.ts            # Main entry point
│   └── worker/                 # Cloudflare Worker code
│       └── index.ts            # Worker entry point
├── public/                     # Static assets
├── index.html                  # Main HTML template
└── ...                         # Configuration files
```

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/GomokuLLM.git
   cd GomokuLLM
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Development

### Client-side Development

The client-side code is located in the `src/client` directory. It uses TypeScript and is built with Vite.

### Worker Development

The Cloudflare Worker code is located in the `src/worker` directory. It handles API requests and serves the static files.

## Deployment

### Deploying to Cloudflare Workers

1. Configure your Cloudflare account in `wrangler.toml`

2. Set up your API key:
   ```
   wrangler secret put GOMOKU_AI_API_KEY
   ```

3. Build and deploy:
   ```
   npm run build
   npm run deploy:worker
   ```

## AI Integration

### Local AI Algorithms

The game includes several local AI algorithms with different difficulty levels:

- **Easy**: Uses simple strategy with random moves
- **Medium**: Uses more advanced evaluation with basic threat detection
- **Hard**: Uses sophisticated evaluation with deeper search

### LLM API Integration

For the most challenging AI, the game can connect to LLM APIs like Claude or GPT:

1. Set up your API key in Cloudflare Worker
2. Select "LLM API" as the AI type in the game settings
3. The AI will use the LLM to analyze the board and make strategic moves

## Future Improvements

- Implement MiniMax, NegaMax, and Alpha-Beta pruning algorithms
- Add game history and replay functionality
- Support for multiplayer games
- More advanced board analysis using LLMs
- Mobile app using the same core logic

## License

This project is licensed under the MIT License - see the LICENSE file for details.