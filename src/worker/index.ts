/**
 * Gomoku Game Cloudflare Worker
 * Handles API requests and serves the static files
 */

// Import types
import { Difficulty } from '../client/game/types';
import { ExecutionContext } from '@cloudflare/workers-types';

// Environment variables interface
interface Env {
  GOMOKU_AI_API_KEY?: string;
  ENVIRONMENT?: string;
}

// Event listener for fetch events
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Allow CORS for development
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Parse the URL
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle API requests
    if (path.startsWith('/api/')) {
      return handleAPI(request, env);
    }

    // Serve static files
    return handleStaticFiles(request, path);
  }
};

/**
 * Handle CORS preflight requests
 */
function handleCORS(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Handle API requests
 */
async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle move API
  if (path === '/api/move') {
    return handleMoveAPI(request, env);
  }

  // 404 for unknown API endpoints
  return new Response('API endpoint not found', { status: 404 });
}

/**
 * Handle move API requests
 */
async function handleMoveAPI(request: Request, env: Env): Promise<Response> {
  // Validate request method
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Parse request body
    const data = await request.json();
    const { board, difficulty } = data;

    // Validate request parameters
    if (!board || !Array.isArray(board) || board.length !== 15) {
      return new Response('Invalid board data', { status: 400 });
    }

    // Calculate AI move
    const move = await calculateAIMove(board, difficulty, env);

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        move
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('AI move error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

/**
 * Calculate AI move
 */
async function calculateAIMove(board: number[][], difficulty: Difficulty, env: Env): Promise<{ x: number, y: number }> {
  // Use different strategies based on difficulty
  if (difficulty === 'easy') {
    return calculateSimpleMove(board);
  } else if (difficulty === 'medium') {
    return calculateMediumMove(board);
  } else {
    // For hard difficulty, use LLM API if available
    if (env.GOMOKU_AI_API_KEY) {
      try {
        return await calculateLLMMove(board, env);
      } catch (error) {
        console.error('LLM API error:', error);
        // Fallback to medium difficulty if LLM API fails
        return calculateMediumMove(board);
      }
    } else {
      // Fallback to medium difficulty if no API key
      return calculateMediumMove(board);
    }
  }
}

/**
 * Calculate move using simple strategy
 */
function calculateSimpleMove(board: number[][]): { x: number, y: number } {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const BOARD_SIZE = 15;
  
  // Check for blocking moves
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY) {
        // Check if this is a blocking move
        if (isThreateningPosition(board, x, y, BLACK)) {
          return { x, y };
        }
      }
    }
  }
  
  // Find positions with neighbors
  const candidates: { x: number, y: number }[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY && hasNeighbor(board, x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  
  // If no candidates, use center position
  if (candidates.length === 0) {
    return { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) };
  }
  
  // Return a random candidate
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Calculate move using medium strategy
 */
function calculateMediumMove(board: number[][]): { x: number, y: number } {
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const BOARD_SIZE = 15;
  
  // Check for winning move
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY) {
        // Try placing a white stone
        board[y][x] = WHITE;
        if (checkWin(board, x, y, WHITE)) {
          // Restore board
          board[y][x] = EMPTY;
          return { x, y };
        }
        // Restore board
        board[y][x] = EMPTY;
      }
    }
  }
  
  // Check for blocking move
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY) {
        // Try placing a black stone
        board[y][x] = BLACK;
        if (checkWin(board, x, y, BLACK)) {
          // Restore board
          board[y][x] = EMPTY;
          return { x, y };
        }
        // Restore board
        board[y][x] = EMPTY;
      }
    }
  }
  
  // Evaluate positions
  let bestScore = -Infinity;
  let bestMove: { x: number, y: number } | null = null;
  
  // Find positions with neighbors
  const candidates: { x: number, y: number }[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY && hasNeighbor(board, x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  
  // If no candidates, use center position
  if (candidates.length === 0) {
    return { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) };
  }
  
  // Evaluate each candidate
  for (const { x, y } of candidates) {
    board[y][x] = WHITE;
    const score = evaluatePosition(board, x, y, WHITE) * 1.5 - evaluatePosition(board, x, y, BLACK);
    board[y][x] = EMPTY;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = { x, y };
    }
  }
  
  return bestMove || candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Calculate move using LLM API
 */
async function calculateLLMMove(board: number[][], env: Env): Promise<{ x: number, y: number }> {
  // Format board for LLM
  const boardRepresentation = board.map(row => 
    row.map(cell => cell === 0 ? '.' : cell === 1 ? 'X' : 'O').join(' ')
  ).join('\n');
  
  // Create prompt
  const prompt = `你是五子棋AI助手。我给你展示当前的棋盘状态，请分析并给出白棋(O)的最佳落子位置。
黑棋用X表示，白棋用O表示，空位用.表示。
棋盘状态:
${boardRepresentation}

请分析棋局并给出你认为最佳的下一步落子位置，格式为坐标(x,y)，左上角为(0,0)。只需要回复坐标，不要其他解释。`;
  
  // Call LLM API (using Anthropic Claude API as an example)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.GOMOKU_AI_API_KEY || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${await response.text()}`);
  }
  
  const result = await response.json();
  
  // Parse response to get coordinates
  const move = parseAIResponse(result);
  
  if (move && isValidMove(board, move.x, move.y)) {
    return move;
  } else {
    // Fallback to medium difficulty if parsing fails
    return calculateMediumMove(board);
  }
}

/**
 * Parse AI response to extract coordinates
 */
function parseAIResponse(response: any): { x: number, y: number } | null {
  try {
    // Extract coordinates using regex
    const content = response.content[0].text;
    const match = content.match(/\((\d+),\s*(\d+)\)/);
    
    if (match) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      return { x, y };
    }
    
    return null;
  } catch (error) {
    console.error('Parse AI response error:', error);
    return null;
  }
}

/**
 * Check if a position is threatening
 */
function isThreateningPosition(board: number[][], x: number, y: number, player: number): boolean {
  // Try placing a stone
  board[y][x] = player;
  
  // Check if this creates a threat
  const isThreat = checkWin(board, x, y, player);
  
  // Restore board
  board[y][x] = 0;
  
  return isThreat;
}

/**
 * Check if a position has neighboring stones
 */
function hasNeighbor(board: number[][], x: number, y: number, range: number = 2): boolean {
  const BOARD_SIZE = 15;
  
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE &&
          board[ny][nx] !== 0) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if a move is valid
 */
function isValidMove(board: number[][], x: number, y: number): boolean {
  const BOARD_SIZE = 15;
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[y][x] === 0;
}

/**
 * Check if a player has won
 */
function checkWin(board: number[][], x: number, y: number, player: number): boolean {
  const BOARD_SIZE = 15;
  const directions = [
    [1, 0],   // horizontal
    [0, 1],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1]   // diagonal up-right
  ];
  
  for (const [dx, dy] of directions) {
    let count = 1;  // current position already has one stone
    
    // Count in one direction
    for (let i = 1; i <= 4; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE &&
          board[ny][nx] === player) {
        count++;
      } else {
        break;
      }
    }
    
    // Count in the opposite direction
    for (let i = 1; i <= 4; i++) {
      const nx = x - dx * i;
      const ny = y - dy * i;
      
      if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE &&
          board[ny][nx] === player) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 5) {
      return true;
    }
  }
  
  return false;
}

/**
 * Evaluate a position
 */
function evaluatePosition(board: number[][], x: number, y: number, player: number): number {
  let score = 0;
  const directions = [
    [1, 0],   // horizontal
    [0, 1],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1]   // diagonal up-right
  ];
  
  for (const [dx, dy] of directions) {
    score += evaluateDirection(board, x, y, dx, dy, player);
  }
  
  return score;
}

/**
 * Evaluate a direction
 */
function evaluateDirection(board: number[][], x: number, y: number, dx: number, dy: number, player: number): number {
  const opponent = player === 1 ? 2 : 1;
  const BOARD_SIZE = 15;
  let pattern = '';
  
  // Get pattern in this direction
  for (let i = -4; i <= 4; i++) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    
    if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (board[ny][nx] === player) {
        pattern += 'O';
      } else if (board[ny][nx] === opponent) {
        pattern += 'X';
      } else {
        pattern += '.';
      }
    } else {
      pattern += 'X'; // Treat out-of-bounds as opponent's stones
    }
  }
  
  // Score based on patterns
  let score = 0;
  
  // Five in a row
  if (pattern.includes('OOOOO')) {
    score += 10000;
  }
  
  // Open four
  if (pattern.includes('.OOOO.')) {
    score += 5000;
  }
  
  // Blocked four
  if (pattern.match(/^OOOO\./) || 
      pattern.match(/\.OOOO$/) || 
      pattern.includes('OOO.O') || 
      pattern.includes('OO.OO') || 
      pattern.includes('O.OOO')) {
    score += 1000;
  }
  
  // Open three
  if (pattern.includes('.OOO.')) {
    score += 500;
  }
  
  // Blocked three
  if (pattern.match(/^OOO\./) || 
      pattern.match(/\.OOO$/) || 
      pattern.includes('OO.O') || 
      pattern.includes('O.OO')) {
    score += 100;
  }
  
  // Open two
  if (pattern.includes('.OO.')) {
    score += 50;
  }
  
  // Blocked two
  if (pattern.match(/^OO\./) || 
      pattern.match(/\.OO$/) || 
      pattern.includes('O.O')) {
    score += 10;
  }
  
  return score;
}

/**
 * Handle static file requests
 */
async function handleStaticFiles(_request: Request, path: string): Promise<Response> {
  // Serve index.html for root path
  if (path === '/' || path === '/index.html') {
    // In a real deployment, you would serve the built index.html
    // For now, redirect to the development server
    return new Response('Redirecting to development server', {
      status: 302,
      headers: {
        'Location': 'http://localhost:3000'
      }
    });
  }

  // 404 for unknown paths
  return new Response('Not found', { status: 404 });
}