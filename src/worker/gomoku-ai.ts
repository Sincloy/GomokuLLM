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