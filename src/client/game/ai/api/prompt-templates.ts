import { CellState } from '../../types';

/**
 * Format the board state for LLM prompts
 * Converts the board to a string representation that's easier for LLMs to understand
 */
export function formatBoardForLLM(board: CellState[][]): string {
  return board.map(row => 
    row.map(cell => {
      switch (cell) {
        case CellState.EMPTY:
          return '.';
        case CellState.BLACK:
          return 'X';
        case CellState.WHITE:
          return 'O';
        default:
          return '.';
      }
    }).join(' ')
  ).join('\n');
}

/**
 * Generate a prompt for the LLM to make a move
 */
export function generateMovePrompt(board: CellState[][]): string {
  const boardRepresentation = formatBoardForLLM(board);
  
  return `你是五子棋AI助手。我给你展示当前的棋盘状态，请分析并给出白棋(O)的最佳落子位置。
黑棋用X表示，白棋用O表示，空位用.表示。
棋盘状态:
${boardRepresentation}

请分析棋局并给出你认为最佳的下一步落子位置，格式为坐标(x,y)，左上角为(0,0)。只需要回复坐标，不要其他解释。`;
}

/**
 * Generate a prompt for the LLM to analyze a game
 */
export function generateAnalysisPrompt(board: CellState[][], moveHistory: string[]): string {
  const boardRepresentation = formatBoardForLLM(board);
  const historyText = moveHistory.join('\n');
  
  return `你是五子棋分析专家。请分析以下棋局并提供专业见解。
黑棋用X表示，白棋用O表示，空位用.表示。

棋盘状态:
${boardRepresentation}

棋局历史:
${historyText}

请提供以下分析:
1. 当前局势评估（谁占优势）
2. 双方关键着法分析
3. 对于下一步的建议
4. 可能的获胜策略`;
}

/**
 * Parse LLM response to extract move coordinates
 */
export function parseLLMResponse(response: string): { x: number, y: number } | null {
  try {
    // Extract coordinates using regex
    const match = response.match(/\((\d+),\s*(\d+)\)/);
    
    if (match) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);
      return { x, y };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    return null;
  }
}