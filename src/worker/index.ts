/**
 * Gomoku Game Cloudflare Worker
 * Handles API requests and serves the static files
 */

// Import types
import { Difficulty } from '../client/game/types';
import { ExecutionContext } from '@cloudflare/workers-types';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from "openai";
import { calculateMediumMove, checkWin, analyzeBoard, EMPTY, BLACK, WHITE, BOARD_SIZE } from './gomoku-ai';

// Environment variables interface
interface Env {
  // API配置
  GOMOKU_AI_API_KEY?: string;
  GOMOKU_AI_MODEL?: string;
  GOMOKU_AI_BASE_URL?: string;
  GOMOKU_AI_MAX_TOKENS?: string; // 使用字符串类型，后续会转为数字
  GOMOKU_AI_TEMPERATURE?: string; // 使用字符串类型，后续会转为数字
  GOMOKU_AI_THINKING_ENABLED?: string; // "true" 或 "false"
  GOMOKU_AI_THINKING_BUDGET?: string; // thinking 模式的预算令牌数


  GOMOKU_OPENAI_API_KEY?: string;
  GOMOKU_OPENAI_MODEL?: string;
  GOMOKU_OPENAI_BASE_URL?: string;
  GOMOKU_OPENAI_MAX_TOKENS?: string;
  GOMOKU_OPENAI_TEMPERATURE?: string;
  
  // 系统配置
  ENVIRONMENT?: string;
  GOMOKU_AI_PROVIDER?: string; // "anthropic" 或 "openai"
  
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
    const moveResult = await calculateAIMove(board, difficulty, env);

    const response: any = {
      success: true,
      move: {
        x: moveResult.x,
        y: moveResult.y
      }
    };

    response.infos = moveResult.info;

    // Return response
    return new Response(
      JSON.stringify(response),
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
async function calculateAIMove(board: number[][], difficulty: Difficulty, env: Env): Promise<{ x: number, y: number, info?: string}> {
  // Use different strategies based on difficulty
  if (difficulty === 'easy') {
    const move = calculateSimpleMove(board);
    return {
      ...move,
      info: "使用简单策略计算的移动。"
    };
  } else if (difficulty === 'medium') {
    const move = calculateMediumMove(board);
    return {
      ...move,
      info: "使用中等难度策略计算的移动。"
    };
  } else {
    // For hard difficulty, use LLM API if available
    if (env.GOMOKU_AI_API_KEY) {
      try {
        return await calculateLLMMove(board, env);
      } catch (error) {
        console.error('LLM API error:', error);
        // 如果LLM API失败，回退到中等难度
        const move = calculateMediumMove(board);
        return {
          ...move,
          info: "由于API调用失败，使用了中等难度的策略。"
        };
      }
    } else {
      const move = calculateMediumMove(board);
      return {
        ...move,
        info: "由于未配置API密钥，使用了中等难度的策略。"
      };
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
 * Calculate move using LLM API
 */
async function calculateLLMMove(board: number[][], env: Env): Promise<{ x: number, y: number, info?: string }> {
  const boardAnalysis = analyzeBoard(board);

  if (boardAnalysis.shouldSurrender) {
    return {
      x: -1, 
      y: -1, 
      info: "AI选择投降，因为:" + boardAnalysis.surrenderReason
    };
  }

  // Format board for LLM
  const boardRepresentation = board.map(row => 
    row.map(cell => cell === 0 ? '#' : cell === 1 ? 'X' : 'O').join(' ')
  ).join('\n');
  
  // 创建增强的提示，包括棋盘分析结果
  let prompt = `你是五子棋AI助手。你必须清楚五子棋的规则，以及五子棋获胜的诀窍。请分析下面的棋盘状态，并给出白棋(O)的最佳落子位置。
  
棋盘说明：15*15的棋盘，左上角为(0,0)，X代表黑棋，O代表白棋，#代表空位

棋盘状态:
${boardRepresentation}

`;

  // 根据局势紧急程度添加不同的指令
  if (boardAnalysis.urgencyLevel === "critical") {
    prompt += `警告：当前局势非常紧急！${boardAnalysis.urgencyReason}

我已经分析出了关键移动，你必须选择其中一个:
${boardAnalysis.topMoves.slice(0, 3).map((move, index) => 
  `${index+1}. 坐标(${move.x},${move.y}) - ${move.reason}`
).join('\n')}

请迅速选择一个上述位置，不要考虑其他选项。
请只返回一个坐标，格式为(x,y)。只需要回复坐标，不要其他解释。`;
  } 
  else if (boardAnalysis.urgencyLevel === "high") {
    prompt += `当前局势需要注意！${boardAnalysis.urgencyReason}

推荐移动位置:
${boardAnalysis.topMoves.slice(0, 3).map((move, index) => 
  `${index+1}. 坐标(${move.x},${move.y}) - ${move.reason}`
).join('\n')}

请基于以上推荐和你的五子棋知识快速做出选择。
请只返回一个坐标，格式为(x,y)。只需要回复坐标，不要其他解释。`;
  }
  else {
    prompt += `算法分析结果:
${boardAnalysis.analysisText}

推荐的移动位置有:
${boardAnalysis.topMoves.slice(0, 5).map((move, index) => 
  `${index+1}. 坐标(${move.x},${move.y}) - 评分: ${move.score}，${move.reason}`
).join('\n')}

请基于上述信息和你的五子棋知识分析棋局，并给出你认为最佳的下一步落子位置。
请只返回一个坐标，格式为(x,y)。只需要回复坐标，不要其他解释。`;
  }
  
  const aiProvider = env.GOMOKU_AI_PROVIDER?.toLowerCase() || 'anthropic';

  // Call LLM API (using Anthropic Claude API as an example)
  try {
    let response;
    if (aiProvider === 'openai') {
      response = await callOpenAI(prompt, env);
    } else {
      response = await callAnthropic(prompt, env);
    }

    const move = parseAIResponse(response);
    
    if (move && isValidMove(board, move.x, move.y)) {
      return move;
    }
  } catch (error) {
    console.error("AI API error:", error);
  }
  
  // 如果API调用失败或移动无效，则回退到中等难度
  const move = calculateMediumMove(board);
  return {
    x: move.x,
    y: move.y,
    info: "error in Call LLM API"
  };
}

/**
 * 调用Anthropic Claude API
 */
async function callAnthropic(prompt: string, env: Env): Promise<any> {  
  const anthropic = new Anthropic({
    apiKey: env.GOMOKU_AI_API_KEY || '',
    baseURL: env.GOMOKU_AI_BASE_URL || "https://gateway.ai.cloudflare.com/v1/1e12109eb2e474efbb60c50c0819e29b/gomoku-ai/anthropic",
  });
  
  const enableThinking = env.GOMOKU_AI_THINKING_ENABLED ? 
                      env.GOMOKU_AI_THINKING_ENABLED.toLowerCase() === "true" : 
                      false;

  let thinkingBudget = env.GOMOKU_AI_THINKING_BUDGET ? parseInt(env.GOMOKU_AI_THINKING_BUDGET) : 10000; // 默认预算
  let maxTokens = env.GOMOKU_AI_MAX_TOKENS ? parseInt(env.GOMOKU_AI_MAX_TOKENS) : 100;
  let temperature = env.GOMOKU_AI_TEMPERATURE ? parseFloat(env.GOMOKU_AI_TEMPERATURE) : 0;
  
  if (enableThinking && maxTokens <= thinkingBudget) {
    maxTokens = thinkingBudget + 5000;
  }
  if (enableThinking){
    temperature = 1;
  }
  
  return await anthropic.messages.create({
    model: env.GOMOKU_AI_MODEL || 'claude-3-7-sonnet-20250219',
    messages: [{role: "user", content: prompt}],
    max_tokens: maxTokens,
    temperature: temperature,
    thinking: enableThinking ? {
      type: "enabled",
      budget_tokens: thinkingBudget
    } : undefined,
  });
}


/**
 * 调用OpenAI API
 */
async function callOpenAI(prompt: string, env: Env): Promise<any> {  
  const openai = new OpenAI({ 
    apiKey: env.GOMOKU_OPENAI_API_KEY || '',
    baseURL: env.GOMOKU_OPENAI_BASE_URL || 'https://api.openai.com/v1'
  });

  const maxTokens = env.GOMOKU_OPENAI_MAX_TOKENS ? parseInt(env.GOMOKU_OPENAI_MAX_TOKENS) : 1000;
  const temperature = env.GOMOKU_OPENAI_TEMPERATURE ? parseFloat(env.GOMOKU_OPENAI_TEMPERATURE) : 0;

  const response = await openai.chat.completions.create({
    model: env.GOMOKU_OPENAI_MODEL || 'gpt-4-turbo',
    messages: [
      { role: "system", content: "你是一个五子棋专家AI助手。你只会输出坐标，不会输出其他内容。" },
      { role: "user", content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
  });

  return response;
}

/**
 * Parse AI response to extract coordinates
 */
function parseAIResponse(response: any): { x: number, y: number, info: string } | null {
  try {
    // 确保我们有一个响应对象
    if (!response) return null;
    console.info(response)
    
    // 如果收到的是字符串，尝试解析为JSON
    let jsonResponse = response;
    if (typeof response === 'string') {
      try {
        jsonResponse = JSON.parse(response);
      } catch (e) {
        // 如果不是有效的JSON，则直接从字符串中提取坐标
        const move = extractCoordinatesFromText(response);
        if(move){
          return {
            x: move.x,
            y: move.y,
            info: "error, is not json format string",
          }
        }
        return null;
          
        
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
    }else if (jsonResponse.choices && Array.isArray(jsonResponse.choices)) {
      if (jsonResponse.choices[0]?.message?.content) {
        responseText = jsonResponse.choices[0].message.content;
      } else if (jsonResponse.choices[0]?.text) {
        responseText = jsonResponse.choices[0].text;
      }
    }
    else if (jsonResponse.text) {
      // 兼容其他可能的格式
      responseText = jsonResponse.text;
    } else if (typeof jsonResponse === 'string') {
      // 如果已经是字符串
      responseText = jsonResponse;
    }
    
    // 从提取的文本中获取坐标
    const move = extractCoordinatesFromText(responseText);
    if(move){
      return {
        x: move?.x,
        y: move?.y,
        info: responseText
      };
    }
    return null;
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