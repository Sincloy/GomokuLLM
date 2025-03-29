/**
 * Gomoku Game Cloudflare Worker
 * Handles API requests and serves the static files
 */

// Import types
import { Difficulty } from '../client/game/types';
import { ExecutionContext } from '@cloudflare/workers-types';
import Anthropic from '@anthropic-ai/sdk';

// Environment variables interface
interface Env {
  // API配置
  GOMOKU_AI_API_KEY?: string;
  GOMOKU_AI_MODEL?: string;
  GOMOKU_AI_BASE_URL?: string;
  GOMOKU_AI_MAX_TOKENS?: string; // 使用字符串类型，后续会转为数字
  GOMOKU_AI_TEMPERATURE?: string; // 使用字符串类型，后续会转为数字
  
  // 系统配置
  ENVIRONMENT?: string;
  
  // Cloudflare Workers 资源
  ASSETS: { fetch: (request: Request) => Promise<Response> };
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
  
    // 提供静态文件（传递 env 参数）
    return handleStaticFiles(request, path, env);
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
    row.map(cell => cell === 0 ? '#' : cell === 1 ? 'X' : 'O').join(' ')
  ).join('\n');
  
  // Create prompt
  const prompt = `你是五子棋AI助手。请分析下面的棋盘状态，并给出白棋(O)的最佳落子位置。
  棋盘说明：15*15的棋盘，左上角为(0,0)，X代表黑棋，O代表白棋，#代表空位
  棋盘状态:
  ${boardRepresentation}
  请分析棋局并给出你认为最佳的下一步落子位置, 请只返回一个坐标, 格式为(x,y), 如(7,4)表示第7列第4行(有第0列和第0行)。只需要回复坐标，不要其他解释`;
  // Call LLM API (using Anthropic Claude API as an example)
  try {
    const anthropic = new Anthropic({
      apiKey: env.GOMOKU_AI_API_KEY || '',
      baseURL: env.GOMOKU_AI_BASE_URL || "https://gateway.ai.cloudflare.com/v1/1e12109eb2e474efbb60c50c0819e29b/gomoku-ai/anthropic",
    });
    
    const response = await anthropic.messages.create({
      model: env.GOMOKU_AI_MODEL || 'claude-3-7-sonnet-20250219',
      messages: [{role: "user", content: prompt}],
      max_tokens: env.GOMOKU_AI_MAX_TOKENS ? parseInt(env.GOMOKU_AI_MAX_TOKENS) : 100,
      temperature: env.GOMOKU_AI_TEMPERATURE ? parseFloat(env.GOMOKU_AI_TEMPERATURE) : 0
    });

    const move = parseAIResponse(response);
    
    if (move && isValidMove(board, move.x, move.y)) {
      return move;
    }
  } catch (error) {
    console.error("AI API error:", error);
  }
  
  // 如果API调用失败或移动无效，则回退到中等难度
  return calculateMediumMove(board);
}

/**
 * Parse AI response to extract coordinates
 */
function parseAIResponse(response: any): { x: number, y: number } | null {
  try {
    // 确保我们有一个响应对象
    if (!response) return null;
    
    // 如果收到的是字符串，尝试解析为JSON
    let jsonResponse = response;
    if (typeof response === 'string') {
      try {
        jsonResponse = JSON.parse(response);
      } catch (e) {
        // 如果不是有效的JSON，则直接从字符串中提取坐标
        return extractCoordinatesFromText(response);
      }
    }
    
    // 从API响应JSON对象中提取文本内容
    let responseText = '';
    
    // 处理标准Claude API响应格式
    if (jsonResponse.content && Array.isArray(jsonResponse.content)) {
      // 遍历所有内容块，提取文本
      for (const block of jsonResponse.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }
    } else if (jsonResponse.text) {
      // 兼容其他可能的格式
      responseText = jsonResponse.text;
    } else if (typeof jsonResponse === 'string') {
      // 如果已经是字符串
      responseText = jsonResponse;
    }
    
    // 从提取的文本中获取坐标
    return extractCoordinatesFromText(responseText);
  } catch (error) {
    console.error('Parse AI response error:', error);
    return null;
  }
}

/**
 * 从文本中提取坐标
 */
function extractCoordinatesFromText(text: string): { x: number, y: number } | null {
  if (!text) return null;
  
  // 清理响应文本
  const cleanedResponse = text.trim();
  
  // 匹配括号内的坐标，考虑多种格式：
  // 1. (7, 4) - 英文逗号带空格
  // 2. (7,4) - 英文逗号无空格
  // 3. (7，4) - 中文逗号带空格
  // 4. (7，4) - 中文逗号无空格
  const bracketsRegex = /\((\d{1,2})[\s]*[,，][\s]*(\d{1,2})\)/;
  const bracketFormat = cleanedResponse.match(bracketsRegex);
  if (bracketFormat) {
    return {
      x: parseInt(bracketFormat[1], 10),
      y: parseInt(bracketFormat[2], 10)
    };
  }
  
  // 匹配无括号的坐标，考虑中英文逗号和空格变体
  const commaRegex = /(\d{1,2})[\s]*[,，][\s]*(\d{1,2})/;
  const commaFormat = cleanedResponse.match(commaRegex);
  if (commaFormat) {
    return {
      x: parseInt(commaFormat[1], 10),
      y: parseInt(commaFormat[2], 10)
    };
  }
  
  // 尝试匹配任何两个连续的数字
  const consecutiveNumbers = cleanedResponse.match(/(\d{1,2})[\s\W]+(\d{1,2})/);
  if (consecutiveNumbers) {
    return {
      x: parseInt(consecutiveNumbers[1], 10),
      y: parseInt(consecutiveNumbers[2], 10)
    };
  }
  
  // 最后尝试匹配任何两个相邻的数字
  const numbers = cleanedResponse.match(/\d{1,2}/g);
  if (numbers && numbers.length >= 2) {
    return {
      x: parseInt(numbers[0], 10),
      y: parseInt(numbers[1], 10)
    };
  }
  
  console.warn('Could not parse coordinates from text:', cleanedResponse);
  return null;
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
async function handleStaticFiles(request: Request, _path: string, env: Env): Promise<Response> {
    // 检查环境变量
    if (env.ENVIRONMENT !== "production") {
      // 在开发环境中重定向到开发服务器
      return new Response('Redirecting to development server', {
        status: 302,
        headers: {
          'Location': 'http://localhost:3000'
        }
      });
    }
  
    try {
        // 这会自动处理 index.html 和其他静态资源
        return await env.ASSETS.fetch(request);
    } catch (error) {
        console.error('Error serving static file:', error);
        return new Response('File not found', { status: 404 });
    }
  }