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
    const { board, difficulty, moveHistory, gameId } = data;

    // Validate request parameters
    if (!board || !Array.isArray(board) || board.length !== 15) {
      return new Response('Invalid board data', { status: 400 });
    }

    // Calculate AI move with history context
    const moveResult = await calculateAIMove(board, difficulty, env, moveHistory, gameId);

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
 * Calculate AI move with enhanced context
 */
async function calculateAIMove(
  board: number[][], 
  difficulty: Difficulty, 
  env: Env, 
  moveHistory?: string[], 
  gameId?: string
): Promise<{ x: number, y: number, info?: string}> {
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
        return await calculateLLMMove(board, env, moveHistory, gameId);
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
 * Calculate move using LLM API with enhanced context
 */
async function calculateLLMMove(
  board: number[][], 
  env: Env, 
  moveHistory?: string[], 
  gameId?: string
): Promise<{ x: number, y: number, info?: string }> {
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
  
  // 统计当前回合数
  const totalStones = board.flat().filter(cell => cell !== 0).length;
  const currentTurn = Math.floor(totalStones / 2) + 1;
  
  // 创建专业的系统指令和上下文
  const systemPrompt = createAdvancedSystemPrompt();
  const gameContext = createGameContext(board, boardAnalysis, currentTurn, moveHistory, gameId);
  
  let prompt = `${gameContext}

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

  // Call LLM API with enhanced context
  try {
    let response;
    if (aiProvider === 'openai') {
      response = await callOpenAI(systemPrompt, prompt, env);
    } else {
      response = await callAnthropic(systemPrompt, prompt, env);
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
async function callAnthropic(systemPrompt: string, userPrompt: string, env: Env): Promise<any> {  
  const anthropic = new Anthropic({
    apiKey: env.GOMOKU_AI_API_KEY || '',
    baseURL: env.GOMOKU_AI_BASE_URL || "https://gateway.ai.cloudflare.com/v1/1e12109eb2e474efbb60c50c0819e29b/gomoku-ai/anthropic",
  });
  
  const enableThinking = env.GOMOKU_AI_THINKING_ENABLED ? 
                      env.GOMOKU_AI_THINKING_ENABLED.toLowerCase() === "true" : 
                      true; // 默认启用thinking模式以获得更好的分析

  let thinkingBudget = env.GOMOKU_AI_THINKING_BUDGET ? parseInt(env.GOMOKU_AI_THINKING_BUDGET) : 20000; // 增加thinking预算
  let maxTokens = env.GOMOKU_AI_MAX_TOKENS ? parseInt(env.GOMOKU_AI_MAX_TOKENS) : 200; // 增加最大token数
  let temperature = env.GOMOKU_AI_TEMPERATURE ? parseFloat(env.GOMOKU_AI_TEMPERATURE) : 0.3; // 稍微增加创造性
  
  if (enableThinking && maxTokens <= thinkingBudget) {
    maxTokens = thinkingBudget + 5000;
  }
  
  return await anthropic.messages.create({
    model: env.GOMOKU_AI_MODEL || 'claude-3-7-sonnet-20250219',
    system: systemPrompt,
    messages: [{role: "user", content: userPrompt}],
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
async function callOpenAI(systemPrompt: string, userPrompt: string, env: Env): Promise<any> {  
  const openai = new OpenAI({ 
    apiKey: env.GOMOKU_OPENAI_API_KEY || '',
    baseURL: env.GOMOKU_OPENAI_BASE_URL || 'https://api.openai.com/v1'
  });

  const maxTokens = env.GOMOKU_OPENAI_MAX_TOKENS ? parseInt(env.GOMOKU_OPENAI_MAX_TOKENS) : 1500;
  const temperature = env.GOMOKU_OPENAI_TEMPERATURE ? parseFloat(env.GOMOKU_OPENAI_TEMPERATURE) : 0.3;

  const response = await openai.chat.completions.create({
    model: env.GOMOKU_OPENAI_MODEL || 'gpt-4o',
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
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
 * 创建专业的五子棋AI系统提示
 */
function createAdvancedSystemPrompt(): string {
  return `你是一位世界级五子棋大师AI，拥有深厚的五子棋理论基础和实战经验。

## 你的专业特长：
1. **战术眼光**：能够敏锐识别棋型，包括活二、死二、活三、死三、活四、死四等
2. **战略思维**：理解开局、中局、残局的不同特点和策略重点
3. **计算能力**：能够进行多步计算，预见对手可能的应对
4. **形势判断**：准确评估当前局势，判断攻守转换时机

## 五子棋核心原理：
- **进攻优先**：五子棋是先手优势游戏，积极进攻比被动防守更有效
- **禁手规则**：注意黑棋禁手（双活三、双四、长连），但你执白棋无此限制
- **连接与阻断**：既要连接自己的棋子，又要阻断对手的连线
- **中心控制**：控制棋盘中心区域，获得更多发展空间

## 关键棋型价值评估：
- 五连：即胜
- 活四：下一步必胜，最高优先级
- 死四：需要及时形成或阻止
- 活三：能发展成活四，重要棋型
- 双活三：必胜棋型，需要创造或阻止
- 死三：有限威胁，但仍需关注

## 决策原则：
1. 有胜招先胜招（形成五连）
2. 阻止对手胜招
3. 创造自己的活四
4. 阻止对手活四
5. 创造双活三
6. 阻止对手双活三
7. 形成活三
8. 一般攻防平衡

请基于以上专业知识分析棋局并给出最佳着法。你的回答应该仅包含坐标，格式为(x,y)。`;
}

/**
 * 创建详细的游戏上下文
 */
function createGameContext(
  board: number[][], 
  analysis: any, 
  currentTurn: number, 
  moveHistory?: string[], 
  gameId?: string
): string {
  const boardRepresentation = board.map(row => 
    row.map(cell => cell === 0 ? '·' : cell === 1 ? '●' : '○').join(' ')
  ).join('\n');
  
  // 生成坐标标记
  let boardWithCoords = '   ';
  for (let i = 0; i < 15; i++) {
    boardWithCoords += i.toString().padStart(2, ' ') + ' ';
  }
  boardWithCoords += '\n';
  
  const rows = boardRepresentation.split('\n');
  for (let i = 0; i < rows.length; i++) {
    boardWithCoords += i.toString().padStart(2, ' ') + ' ' + rows[i] + '\n';
  }

  // 构建历史记录部分
  let historySection = '';
  if (moveHistory && moveHistory.length > 0) {
    const recentMoves = moveHistory.slice(-10); // 显示最近10步
    historySection = `

### 近期对局历史：
${recentMoves.map((move, index) => {
  const moveNum = moveHistory.length - recentMoves.length + index + 1;
  return `${moveNum}. ${move}`;
}).join('\n')}
${moveHistory.length > 10 ? '...（显示最近10步）' : ''}
`;
  }

  // 构建游戏会话信息
  let sessionInfo = '';
  if (gameId) {
    sessionInfo = `

### 对局信息：
- 对局ID：${gameId}
- 当前回合：第${currentTurn}回合
- 累计步数：${Math.floor((currentTurn - 1) * 2) + (currentTurn % 2)}步
`;
  }

  return `## 五子棋对局分析（第${currentTurn}回合）
${sessionInfo}
### 棋盘布局：
\`\`\`
${boardWithCoords}
\`\`\`

说明：●代表黑棋(先手)，○代表白棋(你)，·代表空位
坐标系：左上角为(0,0)，右下角为(14,14)
${historySection}
### 智能分析报告：
${analysis.analysisText}

### 当前局势评估：
- **紧急程度**：${analysis.urgencyLevel}
- **形势判断**：${analysis.urgencyReason}

### 推荐着法分析：
${analysis.topMoves.slice(0, 3).map((move: any, index: number) => 
  `${index + 1}. 位置(${move.x},${move.y}) - 评分${move.score} - ${move.reason}`
).join('\n')}

${analysis.shouldSurrender ? 
  `⚠️ **战略建议**：${analysis.surrenderReason}` : 
  ''}

请基于上述专业分析，结合你的五子棋大师级判断，选择最佳着法位置。`;
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