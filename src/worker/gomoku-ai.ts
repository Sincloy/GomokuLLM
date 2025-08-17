// 五子棋AI算法模块

// 棋盘常量
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const BOARD_SIZE = 15;

// 增强的棋型评分表 - 使用更精确的评分系统
const SHAPE_SCORES = [
  // 活二 - 基础进攻
  { score: 20, pattern: [0, 1, 1, 0, 0] },
  { score: 20, pattern: [0, 0, 1, 1, 0] },
  { score: 30, pattern: [0, 1, 0, 1, 0] }, // 跳活二
  
  // 死二 - 受限制的二连
  { score: 10, pattern: [2, 1, 1, 0, 0] },
  { score: 10, pattern: [0, 0, 1, 1, 2] },
  
  // 活三 - 重要进攻棋型
  { score: 5000, pattern: [0, 1, 1, 1, 0] },  // 标准活三
  { score: 4500, pattern: [0, 1, 0, 1, 1, 0] }, // 跳活三
  { score: 4500, pattern: [0, 1, 1, 0, 1, 0] }, // 跳活三
  
  // 死三 - 单边受阻的三连
  { score: 800, pattern: [2, 1, 1, 1, 0] },
  { score: 800, pattern: [0, 1, 1, 1, 2] },
  { score: 600, pattern: [1, 1, 0, 1, 0] },
  { score: 600, pattern: [0, 1, 0, 1, 1] },
  { score: 500, pattern: [1, 0, 1, 1, 0] },
  
  // 活四 - 下一步即胜
  { score: 50000, pattern: [0, 1, 1, 1, 1, 0] }, // 标准活四
  
  // 死四 - 需要及时形成或阻止
  { score: 8000, pattern: [1, 1, 1, 1, 0] },  // 死四
  { score: 8000, pattern: [0, 1, 1, 1, 1] },  // 死四
  { score: 7000, pattern: [1, 1, 0, 1, 1] },  // 跳死四
  { score: 7000, pattern: [1, 0, 1, 1, 1] },  // 跳死四
  { score: 6000, pattern: [1, 1, 1, 0, 1] },  // 跳死四
  
  // 双四 - 必胜
  { score: 80000, pattern: [1, 1, 1, 1, 0, 1] },
  
  // 五连 - 即胜
  { score: 10000000, pattern: [1, 1, 1, 1, 1] }
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
  
  // 对每个候选进行评估 - 使用改进的多层评估策略
  for (const { x, y } of candidates) {
    // 评估己方在此位置的价值
    board[y][x] = WHITE;
    const selfScore = evaluatePositionAdvanced(board, x, y, WHITE);
    const selfTacticalScore = evaluateTacticalValue(board, x, y, WHITE);
    
    // 评估阻止对手在此位置的价值
    board[y][x] = BLACK;
    const opponentScore = evaluatePositionAdvanced(board, x, y, BLACK);
    const opponentTacticalScore = evaluateTacticalValue(board, x, y, BLACK);
    
    // 恢复空位
    board[y][x] = EMPTY;
    
    // 多维度评分系统
    const offensiveValue = selfScore + selfTacticalScore * 2;
    const defensiveValue = opponentScore + opponentTacticalScore * 1.5;
    const positionValue = evaluatePositionBonus(x, y);
    
    // 综合评分 - 进攻优先但不忽视防守
    const totalScore = offensiveValue * 1.8 - defensiveValue * 1.4 + positionValue;
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
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
 * 评估战术价值 - 考虑组合棋型和威胁
 */
export function evaluateTacticalValue(board: number[][], x: number, y: number, player: number): number {
  let tacticalScore = 0;
  
  // 检查是否能形成双活三
  const liveThrees = countLiveThrees(board, x, y, player);
  if (liveThrees >= 2) {
    tacticalScore += 20000; // 双活三是必胜棋型
  } else if (liveThrees === 1) {
    tacticalScore += 2000; // 单活三也很有价值
  }
  
  // 检查是否能形成双四
  const fours = countFours(board, x, y, player);
  if (fours >= 2) {
    tacticalScore += 30000; // 双四必胜
  }
  
  // 检查连接性 - 是否能连接分离的棋子
  const connectivityBonus = evaluateConnectivity(board, x, y, player);
  tacticalScore += connectivityBonus;
  
  // 检查是否在关键点 - 同时威胁多个方向
  const threatDirections = countThreatDirections(board, x, y, player);
  tacticalScore += threatDirections * 200;
  
  return tacticalScore;
}

/**
 * 评估位置奖励 - 基于棋盘位置的静态评分
 */
export function evaluatePositionBonus(x: number, y: number): number {
  const centerX = Math.floor(BOARD_SIZE / 2);
  const centerY = Math.floor(BOARD_SIZE / 2);
  
  // 中心区域奖励
  const distanceToCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  let positionBonus = Math.max(0, 150 - distanceToCenter * 10);
  
  // 天元最高分
  if (x === centerX && y === centerY) {
    positionBonus += 100;
  }
  
  // 边角惩罚
  if (x <= 1 || x >= BOARD_SIZE - 2 || y <= 1 || y >= BOARD_SIZE - 2) {
    positionBonus -= 50;
  }
  
  // 次中心区域奖励
  if (Math.abs(x - centerX) <= 2 && Math.abs(y - centerY) <= 2) {
    positionBonus += 30;
  }
  
  return positionBonus;
}

/**
 * 计算能形成的活三数量
 */
function countLiveThrees(board: number[][], x: number, y: number, player: number): number {
  let count = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    const line = extractLine(board, x, y, dx, dy, 6);
    if (isLiveThreePattern(line, player)) {
      count++;
    }
  }
  
  return count;
}

/**
 * 计算能形成的四连数量
 */
function countFours(board: number[][], x: number, y: number, player: number): number {
  let count = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    const line = extractLine(board, x, y, dx, dy, 6);
    if (isFourPattern(line, player)) {
      count++;
    }
  }
  
  return count;
}

/**
 * 评估连接性 - 是否能连接分离的己方棋子
 */
function evaluateConnectivity(board: number[][], x: number, y: number, player: number): number {
  let connectivityScore = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    const line = extractLine(board, x, y, dx, dy, 5);
    // 检查是否能桥接分离的棋子
    if (canBridgeStones(line, player)) {
      connectivityScore += 300;
    }
  }
  
  return connectivityScore;
}

/**
 * 计算威胁方向数
 */
function countThreatDirections(board: number[][], x: number, y: number, player: number): number {
  let threatCount = 0;
  const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
  
  for (const [dx, dy] of directions) {
    const line = extractLine(board, x, y, dx, dy, 5);
    if (hasThreatPotential(line, player)) {
      threatCount++;
    }
  }
  
  return threatCount;
}

/**
 * 提取指定方向的棋子序列
 */
function extractLine(board: number[][], x: number, y: number, dx: number, dy: number, length: number): number[] {
  const line: number[] = [];
  const start = Math.floor(length / 2);
  
  for (let i = -start; i <= start; i++) {
    const nx = x + dx * i;
    const ny = y + dy * i;
    
    if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      if (i === 0) {
        line.push(1); // 当前位置假设放置己方棋子
      } else {
        line.push(board[ny][nx]);
      }
    } else {
      line.push(2); // 边界视为对方棋子
    }
  }
  
  return line;
}

/**
 * 检查是否为活三模式
 */
function isLiveThreePattern(line: number[], player: number): boolean {
  const pattern = line.map(cell => cell === player ? 1 : (cell === 0 ? 0 : 2));
  
  // 检查各种活三模式
  const liveThreePatterns = [
    [0, 1, 1, 1, 0],
    [0, 1, 0, 1, 1, 0],
    [0, 1, 1, 0, 1, 0]
  ];
  
  for (const targetPattern of liveThreePatterns) {
    if (matchesPattern(pattern, targetPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查是否为四连模式
 */
function isFourPattern(line: number[], player: number): boolean {
  const pattern = line.map(cell => cell === player ? 1 : (cell === 0 ? 0 : 2));
  
  // 检查各种四连模式
  const fourPatterns = [
    [0, 1, 1, 1, 1, 0], // 活四
    [1, 1, 1, 1, 0],    // 死四
    [0, 1, 1, 1, 1],    // 死四
    [1, 1, 0, 1, 1],    // 跳四
    [1, 0, 1, 1, 1]     // 跳四
  ];
  
  for (const targetPattern of fourPatterns) {
    if (matchesPattern(pattern, targetPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查是否能桥接分离的棋子
 */
function canBridgeStones(line: number[], player: number): boolean {
  const pattern = line.map(cell => cell === player ? 1 : (cell === 0 ? 0 : 2));
  
  // 检查桥接模式：1_0_1（两个己方棋子中间有空隙）
  for (let i = 0; i < pattern.length - 2; i++) {
    if (pattern[i] === 1 && pattern[i + 1] === 0 && pattern[i + 2] === 1) {
      return true;
    }
  }
  
  return false;
}

/**
 * 检查是否有威胁潜力
 */
function hasThreatPotential(line: number[], player: number): boolean {
  const pattern = line.map(cell => cell === player ? 1 : (cell === 0 ? 0 : 2));
  
  // 计算己方棋子数量和空位数量
  const ownStones = pattern.filter(cell => cell === 1).length;
  const emptySpaces = pattern.filter(cell => cell === 0).length;
  
  // 如果有2个以上己方棋子且有空位，认为有威胁潜力
  return ownStones >= 2 && emptySpaces >= 2;
}

/**
 * 检查模式是否匹配
 */
function matchesPattern(line: number[], targetPattern: number[]): boolean {
  if (line.length < targetPattern.length) return false;
  
  for (let i = 0; i <= line.length - targetPattern.length; i++) {
    let matches = true;
    for (let j = 0; j < targetPattern.length; j++) {
      if (line[i + j] !== targetPattern[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  
  return false;
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
  
  // 检查获胜威胁 - 直接使用与calculateMediumMove相同的检查逻辑
  const whiteWinningMoves: {x: number, y: number}[] = [];
  const blackWinningMoves: {x: number, y: number}[] = [];
  
  // 检查白棋获胜移动
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY) {
        // 尝试放置白棋
        board[y][x] = WHITE;
        if (checkWin(board, x, y, WHITE)) {
          whiteWinningMoves.push({x, y});
        }
        
        // 尝试放置黑棋
        board[y][x] = BLACK;
        if (checkWin(board, x, y, BLACK)) {
          blackWinningMoves.push({x, y});
        }
        
        // 恢复棋盘
        board[y][x] = EMPTY;
      }
    }
  }
  
  // 白棋有获胜威胁
  if (whiteWinningMoves.length > 0) {
    analysis += `白棋(O)有获胜威胁，位置：${whiteWinningMoves.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
    urgencyLevel = "critical";
    urgencyReason = "白棋有获胜机会，必须抓住！";
  }
  // 黑棋有获胜威胁
  else if (blackWinningMoves.length > 0) {
    analysis += `黑棋(X)有获胜威胁，位置：${blackWinningMoves.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
    urgencyLevel = "critical";
    urgencyReason = "黑棋有获胜威胁，必须阻止！";
    
    // 如果黑棋有多个获胜威胁，检查是否可以同时阻止
    if (blackWinningMoves.length > 1) {
      const canBlockAll = canBlockMultipleThreats(board, blackWinningMoves);
      if (!canBlockAll) {
        shouldSurrender = true;
        surrenderReason = "黑棋有多个获胜威胁，无法同时阻止。";
        analysis += "黑棋已形成多个获胜点，无法同时阻止，建议投降。\n";
      }
    }
  }
  
  // 使用calculateMediumMove中的逻辑检查其他威胁
  const whiteThreatPositions: {x: number, y: number, type: string}[] = [];
  const blackThreatPositions: {x: number, y: number, type: string}[] = [];
  
  // 遍历棋盘找威胁
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY) continue;
      
      // 检查白棋威胁
      board[y][x] = WHITE;
      const whiteScore = evaluatePositionAdvanced(board, x, y, WHITE);
      
      // 检查黑棋威胁
      board[y][x] = BLACK;
      const blackScore = evaluatePositionAdvanced(board, x, y, BLACK);
      
      // 恢复棋盘
      board[y][x] = EMPTY;
      
      // 根据评分判断威胁类型
      if (whiteScore >= 50000) {
        whiteThreatPositions.push({x, y, type: "活四"});
      } else if (whiteScore >= 5000) {
        whiteThreatPositions.push({x, y, type: "活三"});
      }
      
      if (blackScore >= 50000) {
        blackThreatPositions.push({x, y, type: "活四"});
      } else if (blackScore >= 5000) {
        blackThreatPositions.push({x, y, type: "活三"});
      }
    }
  }
  
  // 分析威胁
  const whiteLiveFour = whiteThreatPositions.filter(p => p.type === "活四");
  const whiteLiveThree = whiteThreatPositions.filter(p => p.type === "活三");
  const blackLiveFour = blackThreatPositions.filter(p => p.type === "活四");
  const blackLiveThree = blackThreatPositions.filter(p => p.type === "活三");
  
  // 如果白棋有活四，优先进攻
  if (whiteLiveFour.length > 0) {
    if (urgencyLevel !== "critical") {
      urgencyLevel = "critical";
      urgencyReason = "白棋有活四威胁，可以直接获胜！";
    }
    analysis += `白棋有活四威胁，可以在下一步获胜。\n`;
  }
  // 如果白棋有双活三，也是高优先级
  else if (whiteLiveThree.length > 1) {
    if (urgencyLevel !== "critical") {
      urgencyLevel = "critical";
      urgencyReason = "白棋有双活三，形成必胜局面！";
    }
    analysis += `白棋有双活三，可以形成必胜局面。\n`;
  }
  
  // 如果黑棋有活四，必须阻止
  if (blackLiveFour.length > 0) {
    if (urgencyLevel !== "critical" || !urgencyReason.includes("获胜")) {
      urgencyLevel = "critical";
      urgencyReason = "黑棋有活四威胁，必须立即阻止！";
    }
    analysis += `黑棋有活四威胁，位置: ${blackLiveFour.map(p => `(${p.x},${p.y})`).join(', ')}。\n`;
    
    // 如果黑棋有多个活四，检查是否可以同时阻止
    if (blackLiveFour.length > 1) {
      const canBlockAllFours = canBlockMultipleThreats(board, blackLiveFour);
      if (!canBlockAllFours) {
        shouldSurrender = true;
        surrenderReason = "黑棋有多个活四威胁，无法同时阻止。";
        analysis += "黑棋已形成多个活四，无法同时阻止，建议投降。\n";
      }
    }
  }
  // 如果黑棋有双活三，也是高危
  else if (blackLiveThree.length > 1) {
    if (urgencyLevel !== "critical" || !urgencyReason.includes("获胜")) {
      urgencyLevel = "critical";
      urgencyReason = "黑棋有多个活三威胁，形成双活三！";
    }
    analysis += `黑棋有双活三威胁，需要立即阻止。\n`;
    
    // 检查是否能阻止所有活三
    const canBlockAllThrees = canBlockMultipleThreats(board, blackLiveThree);
    if (!canBlockAllThrees) {
      shouldSurrender = true;
      surrenderReason = "黑棋有多个活三威胁，无法全部阻止，将形成必胜局面。";
      analysis += "黑棋形成多个无法同时阻止的活三，建议投降。\n";
    }
  }
  // 如果只有一个活三，是中等威胁
  else if (blackLiveThree.length === 1) {
    if (urgencyLevel !== "critical") {
      urgencyLevel = "high";
      urgencyReason = "黑棋有活三威胁，需要及时应对。";
    }
    analysis += `黑棋有活三威胁，位置: (${blackLiveThree[0].x},${blackLiveThree[0].y})。\n`;
  }
  
  // 检查是否有长连
  const longConnections = detectLongConnections(board);
  if (longConnections.black && longConnections.black >= 4) {
    shouldSurrender = true;
    surrenderReason = `黑棋已经形成${longConnections.black}连，且双端开放，无法阻挡。`;
    analysis += `黑棋已经形成${longConnections.black}连活棋，建议投降。\n`;
  }
  
  // 评估整体局势 - 使用与calculateMediumMove相同的评估函数
  let whiteScore = 0;
  let blackScore = 0;
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === WHITE) {
        whiteScore += evaluatePositionAdvanced(board, x, y, WHITE);
      } else if (board[y][x] === BLACK) {
        blackScore += evaluatePositionAdvanced(board, x, y, BLACK);
      }
    }
  }
  
  // 分析局势
  if (whiteScore > blackScore * 1.5) {
    analysis += "白棋占据优势，控制了更多有利位置。\n";
  } else if (blackScore > whiteScore * 1.5) {
    analysis += "黑棋占据优势，控制了更多有利位置。\n";
    
    // 如果黑棋优势极大且棋局已进行一段时间，考虑投降
    if (blackScore > whiteScore * 3 && stoneCount.total > 20) {
      shouldSurrender = true;
      surrenderReason = "局势极度不利，黑棋占据绝对优势。";
      analysis += "黑棋已占据绝对优势，建议投降。\n";
    }
  } else {
    analysis += "双方局势相对均衡。\n";
  }
  
  // 获取最佳移动列表
  let bestMoves = findBestMoves(board, 5);
  
  // 如果有紧急威胁，重新排序最佳移动
  if (urgencyLevel === "critical") {
    if (whiteWinningMoves.length > 0) {
      // 优先选择可以获胜的位置
      bestMoves = whiteWinningMoves.map(move => ({
        x: move.x,
        y: move.y,
        score: 1000000,
        reason: "这一步可以直接获胜"
      })).concat(bestMoves);
    } 
    else if (blackWinningMoves.length > 0) {
      // 优先选择可以阻止对手获胜的位置
      bestMoves = blackWinningMoves.map(move => ({
        x: move.x,
        y: move.y,
        score: 900000,
        reason: "这一步可以阻止对手直接获胜"
      })).concat(bestMoves);
    }
    else if (whiteLiveFour.length > 0) {
      // 优先选择可以形成活四的位置
      bestMoves = whiteLiveFour.map(move => ({
        x: move.x,
        y: move.y,
        score: 800000,
        reason: "这一步可以形成活四，下一步可获胜"
      })).concat(bestMoves);
    }
    else if (blackLiveFour.length > 0) {
      // 优先选择可以阻止对手活四的位置
      bestMoves = blackLiveFour.map(move => ({
        x: move.x,
        y: move.y,
        score: 700000,
        reason: "这一步可以阻止对手形成活四"
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
 * 检测棋盘上的长连
 * @param board 棋盘状态
 * @returns 黑白双方的最长连线
 */
function detectLongConnections(board: number[][]): { black: number, white: number } {
  let blackMax = 0;
  let whiteMax = 0;
  
  const directions = [
    [1, 0],   // 水平
    [0, 1],   // 垂直
    [1, 1],   // 右下对角线
    [1, -1]   // 右上对角线
  ];
  
  // 标记已经检查过的位置
  const checked = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(false));
  
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] === EMPTY || checked[y][x]) continue;
      
      const player = board[y][x];
      
      for (const [dx, dy] of directions) {
        // 只检查每个连线的起点（避免重复计算）
        // 如果前一个位置也是同色棋子，则不是起点
        const prevX = x - dx;
        const prevY = y - dy;
        if (prevX >= 0 && prevX < BOARD_SIZE && prevY >= 0 && prevY < BOARD_SIZE && 
            board[prevY][prevX] === player) {
          continue;
        }
        
        // 计算连线长度
        let count = 1;
        let openEnds = 0;
        
        // 检查连线方向
        for (let i = 1; i < 6; i++) {  // 最多检查5个位置（超过5个也是胜利）
          const nx = x + dx * i;
          const ny = y + dy * i;
          
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            if (board[ny][nx] === player) {
              count++;
              checked[ny][nx] = true;  // 标记为已检查
            } else if (board[ny][nx] === EMPTY) {
              openEnds++;  // 一端开放
              break;
            } else {
              break;  // 遇到对方棋子
            }
          } else {
            break;  // 超出边界
          }
        }
        
        // 检查反方向
        for (let i = 1; i < 6; i++) {
          const nx = x - dx * i;
          const ny = y - dy * i;
          
          if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
            if (board[ny][nx] === player) {
              count++;
            } else if (board[ny][nx] === EMPTY) {
              openEnds++;  // 另一端也开放
              break;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        
        // 如果双端开放且连线长度大于等于4，记录最长连线
        if (openEnds === 2 && count >= 4) {
          if (player === BLACK && count > blackMax) {
            blackMax = count;
          } else if (player === WHITE && count > whiteMax) {
            whiteMax = count;
          }
        }
      }
    }
  }
  
  return { black: blackMax, white: whiteMax };
}

/**
 * 检查是否能同时阻止多个威胁
 * @param board 棋盘状态
 * @param threats 威胁位置数组
 * @returns 是否能同时阻止所有威胁
 */
function canBlockMultipleThreats(board: number[][], threats: Array<{x: number, y: number}>): boolean {
  // 如果只有一个威胁，可以阻止
  if (threats.length <= 1) return true;
  
  // 对于每个空位，检查它是否能同时阻止所有威胁
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== EMPTY) continue;
      
      let canBlockAll = true;
      
      // 尝试在这个位置放置白棋，看是否能阻止所有威胁
      board[y][x] = WHITE;
      
      // 对每个威胁位置，检查是否仍然有威胁
      for (const threat of threats) {
        // 如果当前检查的位置就是威胁位置之一，已经被我们放置了白棋，所以这个威胁已被阻止
        if (threat.x === x && threat.y === y) continue;
        
        // 在威胁位置放置黑棋
        board[threat.y][threat.x] = BLACK;
        const stillThreatens = checkWin(board, threat.x, threat.y, BLACK);
        // 恢复威胁位置
        board[threat.y][threat.x] = EMPTY;
        
        // 如果仍然有威胁，说明这个位置不能阻止所有威胁
        if (stillThreatens) {
          canBlockAll = false;
          break;
        }
      }
      
      // 恢复棋盘
      board[y][x] = EMPTY;
      
      // 如果找到一个位置可以阻止所有威胁，返回true
      if (canBlockAll) {
        return true;
      }
    }
  }
  
  // 没有找到能同时阻止所有威胁的位置
  return false;
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