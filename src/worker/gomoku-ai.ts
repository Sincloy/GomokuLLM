// gomokuAI.ts
// 五子棋AI算法模块

// 棋盘常量
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BOARD_SIZE = 15;

// 棋型评分表
const SHAPE_SCORES = [
  { score: 50, pattern: [0, 1, 1, 0, 0] },    // 活二
  { score: 50, pattern: [0, 0, 1, 1, 0] },    // 活二
  { score: 200, pattern: [1, 1, 0, 1, 0] },   // 死三
  { score: 500, pattern: [0, 0, 1, 1, 1] },   // 死三
  { score: 500, pattern: [1, 1, 1, 0, 0] },   // 死三
  { score: 5000, pattern: [0, 1, 1, 1, 0] },  // 活三
  { score: 5000, pattern: [0, 1, 0, 1, 1, 0] }, // 跳活三
  { score: 5000, pattern: [0, 1, 1, 0, 1, 0] }, // 跳活三
  { score: 5000, pattern: [1, 1, 1, 0, 1] },  // 死四
  { score: 5000, pattern: [1, 1, 0, 1, 1] },  // 死四
  { score: 5000, pattern: [1, 0, 1, 1, 1] },  // 死四
  { score: 5000, pattern: [1, 1, 1, 1, 0] },  // 死四
  { score: 5000, pattern: [0, 1, 1, 1, 1] },  // 死四
  { score: 50000, pattern: [0, 1, 1, 1, 1, 0] }, // 活四
  { score: 99999999, pattern: [1, 1, 1, 1, 1] }  // 五连
];

/**
 * 计算AI的最佳移动位置
 * @param board 当前棋盘状态
 * @returns 最佳移动位置的坐标
 */
export function calculateMediumMove(board: number[][]): { x: number, y: number } {
  // 检查获胜移动
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY) {
        // 尝试放置白棋
        board[y][x] = WHITE;
        if (checkWin(board, x, y, WHITE)) {
          // 恢复棋盘
          board[y][x] = EMPTY;
          return { x, y };
        }
        // 恢复棋盘
        board[y][x] = EMPTY;
      }
    }
  }
  
  // 检查阻挡移动
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY) {
        // 尝试放置黑棋
        board[y][x] = BLACK;
        if (checkWin(board, x, y, BLACK)) {
          // 恢复棋盘
          board[y][x] = EMPTY;
          return { x, y };
        }
        // 恢复棋盘
        board[y][x] = EMPTY;
      }
    }
  }

  // 检查强制移动 - 检查是否有活四或双三等威胁
  const threats = findThreats(board, BLACK, WHITE);
  if (threats.length > 0) {
    return threats[0]; // 返回最高威胁的移动
  }
  
  // 评估位置
  let bestScore = -Infinity;
  let bestMove: { x: number, y: number } | null = null;
  
  // 寻找有邻居的位置
  const candidates: { x: number, y: number }[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY && hasNeighbor(board, x, y)) {
        candidates.push({ x, y });
      }
    }
  }
  
  // 如果没有候选位置，使用中心位置
  if (candidates.length === 0) {
    return { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) };
  }
  
  // 对每个候选进行评估
  for (const { x, y } of candidates) {
    board[y][x] = WHITE;
    // 改进了评估函数，更重视自己的进攻
    const selfScore = evaluatePositionAdvanced(board, x, y, WHITE);
    board[y][x] = BLACK; // 临时替换为对手的棋子
    const opponentScore = evaluatePositionAdvanced(board, x, y, BLACK);
    board[y][x] = EMPTY; // 恢复空位
    
    // 攻防平衡的评分 - 调整了权重
    const score = selfScore * 1.5 - opponentScore * 1.2;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = { x, y };
    }
  }
  
  return bestMove || candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 检查某个位置是否形成胜利
 * @param board 棋盘状态
 * @param x X坐标
 * @param y Y坐标
 * @param player 玩家编号
 * @returns 是否获胜
 */
export function checkWin(board: number[][], x: number, y: number, player: number): boolean {
  const directions = [
    [1, 0],   // 水平
    [0, 1],   // 垂直
    [1, 1],   // 右下对角线
    [1, -1]   // 右上对角线
  ];
  
  for (const [dx, dy] of directions) {
    let count = 1;  // 当前位置已有一个棋子
    
    // 一个方向上计数
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
    
    // 反方向上计数
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
 * 检查位置周围是否有邻居
 * @param board 棋盘状态
 * @param x X坐标
 * @param y Y坐标
 * @param range 检查范围
 * @returns 是否有邻居
 */
export function hasNeighbor(board: number[][], x: number, y: number, range: number = 2): boolean {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue; // 跳过自身
      
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
 * 高级位置评估函数
 * @param board 棋盘状态
 * @param x X坐标
 * @param y Y坐标
 * @param player 玩家编号
 * @returns 位置评分
 */
export function evaluatePositionAdvanced(board: number[][], x: number, y: number, player: number): number {
  let totalScore = 0;
  const opponent = player === 1 ? 2 : 1;
  
  const directions = [
    [1, 0],   // 水平
    [0, 1],   // 垂直
    [1, 1],   // 右下对角线
    [1, -1]   // 右上对角线
  ];
  
  for (const [dx, dy] of directions) {
    totalScore += evaluateShapeInDirection(board, x, y, dx, dy, player);
  }
  
  // 位置权重 - 靠近中心的位置更好
  const centerX = Math.floor(BOARD_SIZE / 2);
  const centerY = Math.floor(BOARD_SIZE / 2);
  const distanceToCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  const positionScore = Math.max(0, 100 - distanceToCenter * 5);
  
  return totalScore + positionScore;
}

/**
 * 在一个方向上评估棋型
 * @param board 棋盘状态
 * @param x X坐标
 * @param y Y坐标
 * @param dx X方向增量
 * @param dy Y方向增量
 * @param player 玩家编号
 * @returns 方向评分
 */
function evaluateShapeInDirection(board: number[][], x: number, y: number, dx: number, dy: number, player: number): number {
  const opponent = player === 1 ? 2 : 1;
  
  // 提取一条线上的棋型
  const line: number[] = []; // 0=空, 1=己方棋子, 2=对方棋子
  
  // 开始提取5个位置前的棋子
  for (let i = -5; i <= 5; i++) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    
    if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (board[ny][nx] === player) {
        line.push(1); // 己方棋子表示为1
      } else if (board[ny][nx] === opponent) {
        line.push(2); // 对方棋子表示为2
      } else {
        line.push(0); // 空位表示为0
      }
    } else {
      line.push(2); // 超出边界视为对方棋子
    }
  }
  
  let score = 0;
  
  // 检查棋型
  for (let i = 0; i < line.length - 4; i++) {
    const pattern = line.slice(i, i + 5);
    // 将对方棋子(2)视为障碍(2)，将自己的棋子(1)保持为1
    const normalizedPattern = pattern.map(v => v === 2 ? 2 : v);
    
    // 检查6子棋型
    if (i < line.length - 5) {
      const pattern6 = line.slice(i, i + 6);
      const normalizedPattern6 = pattern6.map(v => v === 2 ? 2 : v);
      
      for (const { score: shapeScore, pattern: shapePattern } of SHAPE_SCORES) {
        if (shapePattern.length === 6 && matchPattern(normalizedPattern6, shapePattern)) {
          score += shapeScore;
          break;
        }
      }
    }
    
    // 检查5子棋型
    for (const { score: shapeScore, pattern: shapePattern } of SHAPE_SCORES) {
      if (shapePattern.length === 5 && matchPattern(normalizedPattern, shapePattern)) {
        score += shapeScore;
        break;
      }
    }
  }
  
  return score;
}

/**
 * 匹配棋型模式
 * @param linePattern 线上的棋型
 * @param shapePattern 形状模式
 * @returns 是否匹配
 */
function matchPattern(linePattern: number[], shapePattern: number[]): boolean {
  if (linePattern.length !== shapePattern.length) return false;
  
  for (let i = 0; i < linePattern.length; i++) {
    // 如果形状模式中有2(对方棋子)，而线上不是2，则不匹配
    if (shapePattern[i] === 2 && linePattern[i] !== 2) return false;
    // 如果形状模式中有1(己方棋子)，而线上不是1，则不匹配
    if (shapePattern[i] === 1 && linePattern[i] !== 1) return false;
    // 如果形状模式中有0(空位)，而线上不是0，则不匹配
    if (shapePattern[i] === 0 && linePattern[i] !== 0) return false;
  }
  
  return true;
}

/**
 * 寻找威胁位置
 * @param board 棋盘状态
 * @param humanPlayer 人类玩家编号
 * @param aiPlayer AI玩家编号
 * @returns 威胁位置列表
 */
function findThreats(board: number[][], humanPlayer: number, aiPlayer: number): { x: number, y: number }[] {
  const threats: Array<{ x: number, y: number, score: number }> = [];
  
  // 寻找能形成威胁的位置
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== 0) continue; // 跳过非空位
      
      // 检查AI方的威胁（活四、冲四等）
      board[y][x] = aiPlayer;
      const aiScore = evaluatePositionAdvanced(board, x, y, aiPlayer);
      
      // 检查人类方的威胁
      board[y][x] = humanPlayer;
      const humanScore = evaluatePositionAdvanced(board, x, y, humanPlayer);
      
      board[y][x] = 0; // 恢复空位
      
      // 如果这是一个高威胁位置
      if (aiScore > 10000 || humanScore > 8000) {
        threats.push({ x, y, score: Math.max(aiScore * 1.5, humanScore) });
      }
    }
  }
  
  // 按分数排序，高分优先
  threats.sort((a, b) => b.score - a.score);
  
  return threats.map(t => ({ x: t.x, y: t.y }));
}

/**
 * 使用中级算法分析棋盘
 * @param board 棋盘状态
 * @returns 分析结果和建议移动
 */
export function analyzeBoard(board: number[][]): { 
  analysisText: string, 
  topMoves: Array<{ x: number, y: number, score: number, reason: string }>,
  urgencyLevel: "normal" | "high" | "critical",
  urgencyReason: string,
  shouldSurrender: boolean,
  surrenderReason: string
} {
  // 分析当前局势
  let analysis = "";
  let urgencyLevel: "normal" | "high" | "critical" = "normal";
  let urgencyReason = "";
  let shouldSurrender = false;
  let surrenderReason = "";
  
  // 统计棋盘上棋子数量
  const stoneCount = countStones(board);
  
  // 检查是否有任一方接近获胜
  const winningThreats = findWinningThreats(board);
  
  // 白棋有获胜威胁 - 优先选择这些位置
  if (winningThreats.white.length > 0) {
    analysis += `白棋(O)有获胜威胁，位置：${winningThreats.white.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
    urgencyLevel = "critical";
    urgencyReason = "白棋有获胜机会，必须抓住！";
  }
  // 黑棋有获胜威胁 - 必须阻止
  else if (winningThreats.black.length > 0) {
    analysis += `黑棋(X)有获胜威胁，位置：${winningThreats.black.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
    urgencyLevel = "critical";
    urgencyReason = "黑棋有获胜威胁，必须阻止！";
  }
  
  // 评估当前局势的优劣
  const situationAnalysis = evaluateBoardSituation(board);
  analysis += situationAnalysis.analysis;
  
  // 如果局势极度不利，考虑投降
  if (situationAnalysis.whiteScore < -50000 && stoneCount.total > 20) {
    shouldSurrender = true;
    surrenderReason = "局势已经不可挽回，黑棋占据绝对优势。";
  }
  
  // 检测黑棋的活三或活四威胁
  const blackThreats = detectThreats(board, BLACK);
  if (blackThreats.liveFour.length > 0) {
    urgencyLevel = "critical";
    urgencyReason = "黑棋有活四威胁，必须立即阻止！";
    analysis += `黑棋有活四威胁，位置: ${blackThreats.liveFour.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
  } 
  else if (blackThreats.liveThree.length > 1) {
    urgencyLevel = "critical";
    urgencyReason = "黑棋有多个活三威胁，形成双活三！";
    analysis += `黑棋有双活三威胁，需要立即阻止。\n`;
  }
  else if (blackThreats.liveThree.length > 0) {
    urgencyLevel = "high";
    urgencyReason = "黑棋有活三威胁，需要及时应对。";
    analysis += `黑棋有活三威胁，位置: ${blackThreats.liveThree.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
  }
  
  // 如果白棋有活四或双活三，应该优先进攻
  const whiteThreats = detectThreats(board, WHITE);
  if (whiteThreats.liveFour.length > 0) {
    urgencyLevel = "critical";
    urgencyReason = "白棋有活四威胁，可以直接获胜！";
    analysis += `白棋有活四威胁，可以在下一步获胜。\n`;
  }
  else if (whiteThreats.liveThree.length > 1) {
    urgencyLevel = "critical";
    urgencyReason = "白棋有双活三，形成必胜局面！";
    analysis += `白棋有双活三，可以形成必胜局面。\n`;
  }
  
  // 获取最佳移动列表
  let bestMoves = findBestMoves(board, 5);
  
  // 如果有紧急威胁，重新排序最佳移动
  if (urgencyLevel === "critical") {
    if (winningThreats.white.length > 0) {
      // 优先选择可以获胜的位置
      bestMoves = winningThreats.white.map(move => ({
        x: move.x,
        y: move.y,
        score: 1000000,
        reason: "这一步可以直接获胜"
      })).concat(bestMoves);
    } 
    else if (winningThreats.black.length > 0) {
      // 优先选择可以阻止对手获胜的位置
      bestMoves = winningThreats.black.map(move => ({
        x: move.x,
        y: move.y,
        score: 900000,
        reason: "这一步可以阻止对手直接获胜"
      })).concat(bestMoves);
    }
    
    // 去除重复项
    bestMoves = bestMoves.filter((move, index, self) =>
      index === self.findIndex((m) => (m.x === move.x && m.y === move.y))
    );
  }
  
  return {
    analysisText: analysis,
    topMoves: bestMoves,
    urgencyLevel,
    urgencyReason,
    shouldSurrender,
    surrenderReason
  };
}

/**
 * 统计棋盘上的棋子数量
 */
function countStones(board: number[][]): { black: number, white: number, total: number } {
  let black = 0;
  let white = 0;
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === BLACK) black++;
      else if (board[y][x] === WHITE) white++;
    }
  }
  
  return { black, white, total: black + white };
}

/**
 * 评估整体棋盘局势
 */
function evaluateBoardSituation(board: number[][]): { 
  whiteScore: number, 
  blackScore: number, 
  analysis: string 
} {
  let whiteScore = 0;
  let blackScore = 0;
  
  // 评估每个已有棋子的位置价值
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === WHITE) {
        whiteScore += evaluatePositionAdvanced(board, x, y, WHITE);
      } else if (board[y][x] === BLACK) {
        blackScore += evaluatePositionAdvanced(board, x, y, BLACK);
      }
    }
  }
  
  // 获取控制区域
  const controlledArea = analyzeControlledArea(board);
  
  let analysis = "";
  if (whiteScore > blackScore * 1.5) {
    analysis += "白棋占据优势，控制了更多有利位置。\n";
  } else if (blackScore > whiteScore * 1.5) {
    analysis += "黑棋占据优势，控制了更多有利位置。\n";
  } else {
    analysis += "双方局势相对均衡。\n";
  }
  
  analysis += `白棋控制区域：${controlledArea.white}格，黑棋控制区域：${controlledArea.black}格。\n`;
  
  return { whiteScore, blackScore, analysis };
}

/**
 * 分析棋盘控制区域
 */
function analyzeControlledArea(board: number[][]): { white: number, black: number } {
  let whiteArea = 0;
  let blackArea = 0;
  
  // 简单方法：检查每个空白位置，看它更接近哪方的棋子
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY) continue;
      
      // 查找最近的白棋和黑棋
      const nearestWhite = findNearestStone(board, x, y, WHITE);
      const nearestBlack = findNearestStone(board, x, y, BLACK);
      
      // 判断控制方
      if (nearestWhite < nearestBlack) {
        whiteArea++;
      } else if (nearestBlack < nearestWhite) {
        blackArea++;
      }
      // 距离相等则不计入任何一方
    }
  }
  
  return { white: whiteArea, black: blackArea };
}

/**
 * 找到最近的指定类型棋子
 */
function findNearestStone(board: number[][], x: number, y: number, stoneType: number): number {
  let minDistance = Infinity;
  
  for (let cy = 0; cy < BOARD_SIZE; cy++) {
    for (let cx = 0; cx < BOARD_SIZE; cx++) {
      if (board[cy][cx] !== stoneType) continue;
      
      const distance = Math.sqrt(Math.pow(cx - x, 2) + Math.pow(cy - y, 2));
      minDistance = Math.min(minDistance, distance);
    }
  }
  
  return minDistance;
}


/**
 * 检测活三和活四威胁
 */
function detectThreats(board: number[][], player: number): {
  liveFour: Array<{x: number, y: number}>,
  liveThree: Array<{x: number, y: number}>
} {
  const liveFour: {x: number, y: number}[] = [];
  const liveThree: {x: number, y: number}[] = [];
  
  // 定义活四和活三的模式
  const liveFourPatterns = [
    [0, 1, 1, 1, 1, 0] // 活四: 0XXXX0
  ];
  
  const liveThreePatterns = [
    [0, 1, 1, 1, 0],   // 活三: 0XXX0
    [0, 1, 0, 1, 1, 0], // 跳活三: 0X0XX0
    [0, 1, 1, 0, 1, 0]  // 跳活三: 0XX0X0
  ];
  
  // 方向数组
  const directions = [
    [1, 0],   // 水平
    [0, 1],   // 垂直
    [1, 1],   // 右下对角线
    [1, -1]   // 右上对角线
  ];
  
  // 检查每个空位
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY) continue;
      
      // 尝试在此位置放置棋子
      board[y][x] = player;
      
      // 检查各个方向
      for (const [dx, dy] of directions) {
        // 提取线上的棋型
        const line: number[] = [];
        
        // 提取一段足够长的线
        for (let i = -5; i <= 5; i++) {
          const nx = x + dx * i;
          const ny = y + dy * i;
          
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            line.push(board[ny][nx]);
          } else {
            line.push(-1); // 边界外标记
          }
        }
        
        // 检查活四模式
        for (const pattern of liveFourPatterns) {
          if (findPatternInLine(line, pattern)) {
            liveFour.push({x, y});
            break;
          }
        }
        
        // 检查活三模式
        for (const pattern of liveThreePatterns) {
          if (findPatternInLine(line, pattern)) {
            liveThree.push({x, y});
            break;
          }
        }
      }
      
      // 恢复空位
      board[y][x] = EMPTY;
    }
  }
  
  return { liveFour, liveThree };
}

/**
 * 在线上查找模式
 */
function findPatternInLine(line: number[], pattern: number[]): boolean {
  for (let i = 0; i <= line.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (pattern[j] !== -1 && line[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/**
 * 寻找获胜威胁
 * @param board 棋盘状态
 * @returns 白棋和黑棋的获胜威胁位置
 */
function findWinningThreats(board: number[][]): {
  white: Array<{x: number, y: number}>,
  black: Array<{x: number, y: number}>
} {
  const whiteThreats: {x: number, y: number}[] = [];
  const blackThreats: {x: number, y: number}[] = [];
  
  // 检查每个空位
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY) continue;
      
      // 检查白棋是否能在这一步获胜
      board[y][x] = WHITE;
      if (checkWin(board, x, y, WHITE)) {
        whiteThreats.push({x, y});
      }
      
      // 检查黑棋是否能在这一步获胜
      board[y][x] = BLACK;
      if (checkWin(board, x, y, BLACK)) {
        blackThreats.push({x, y});
      }
      
      // 恢复空位
      board[y][x] = EMPTY;
    }
  }
  
  return { white: whiteThreats, black: blackThreats };
}

/**
 * 寻找最佳移动位置
 * @param board 棋盘状态
 * @param count 返回的位置数量
 * @returns 评分最高的移动位置列表
 */
function findBestMoves(board: number[][], count: number): Array<{
  x: number, 
  y: number, 
  score: number,
  reason: string
}> {
  const moves: Array<{x: number, y: number, score: number, reason: string}> = [];
  
  // 首先查找获胜和阻止对手获胜的移动
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY) continue;
      
      // 检查白棋获胜
      board[y][x] = WHITE;
      if (checkWin(board, x, y, WHITE)) {
        moves.push({
          x, y, 
          score: 100000, 
          reason: "这一步可以直接获胜"
        });
        board[y][x] = EMPTY;
        continue;
      }
      
      // 检查阻止黑棋获胜
      board[y][x] = BLACK;
      if (checkWin(board, x, y, BLACK)) {
        board[y][x] = EMPTY;
        moves.push({
          x, y, 
          score: 90000, 
          reason: "这一步可以阻止对手直接获胜"
        });
        continue;
      }
      
      // 恢复空位并计算普通评分
      board[y][x] = EMPTY;
      
      // 只评估有邻居的位置
      if (!hasNeighbor(board, x, y)) continue;
      
      // 评估白棋和黑棋的分数
      board[y][x] = WHITE;
      const whiteScore = evaluatePositionAdvanced(board, x, y, WHITE);
      
      board[y][x] = BLACK;
      const blackScore = evaluatePositionAdvanced(board, x, y, BLACK);
      
      board[y][x] = EMPTY;
      
      // 综合评分
      const totalScore = whiteScore * 1.5 - blackScore * 1.2;
      
      // 生成理由
      let reason = "";
      if (whiteScore > 10000 && blackScore > 10000) {
        reason = "既能形成自己的强势，又能阻止对手的强势";
      } else if (whiteScore > 10000) {
        reason = "能形成自己的强势局面";
      } else if (blackScore > 10000) {
        reason = "能阻止对手的强势局面";
      } else if (whiteScore > 5000) {
        reason = "能形成自己的良好局面";
      } else if (blackScore > 5000) {
        reason = "能阻止对手的良好局面";
      } else {
        reason = "综合攻防考虑的常规选择";
      }
      
      moves.push({ x, y, score: totalScore, reason });
    }
  }
  
  // 如果没有找到有效移动，返回中心附近的移动
  if (moves.length === 0) {
    const center = Math.floor(BOARD_SIZE / 2);
    moves.push({
      x: center, 
      y: center, 
      score: 1, 
      reason: "棋局开始，选择中心位置"
    });
  }
  
  // 按分数排序
  moves.sort((a, b) => b.score - a.score);
  
  // 返回前N个移动
  return moves.slice(0, count);
}