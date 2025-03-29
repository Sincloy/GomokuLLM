import { Board } from '../../board';
import { CellState, Position, Difficulty } from '../../types';

/**
 * Simple AI implementation
 * This is a basic AI that uses simple heuristics to make decisions
 */
export class SimpleAI {
  private board: Board;
  private difficulty: Difficulty;
  private player: CellState;
  private opponent: CellState;

  constructor(board: Board, player: CellState = CellState.WHITE, difficulty: Difficulty = Difficulty.MEDIUM) {
    this.board = board;
    this.player = player;
    this.opponent = player === CellState.BLACK ? CellState.WHITE : CellState.BLACK;
    this.difficulty = difficulty;
  }

  /**
   * Get the next move for the AI
   */
  getMove(): Position | null {
    // Check for winning move
    const winningMove = this.findWinningMove();
    if (winningMove) {
      return winningMove;
    }

    // Check for blocking move
    const blockingMove = this.findBlockingMove();
    if (blockingMove) {
      return blockingMove;
    }

    // Use different strategies based on difficulty
    switch (this.difficulty) {
      case Difficulty.EASY:
        return this.getEasyMove();
      case Difficulty.MEDIUM:
        return this.getMediumMove();
      case Difficulty.HARD:
        return this.getHardMove();
      default:
        return this.getMediumMove();
    }
  }

  /**
   * Find a winning move for the AI
   */
  private findWinningMove(): Position | null {
    const boardState = this.board.getBoard();
    const tempBoard = new Board(boardState);

    // Check all empty positions
    for (let y = 0; y < boardState.length; y++) {
      for (let x = 0; x < boardState[y].length; x++) {
        if (boardState[y][x] === CellState.EMPTY) {
          // Try placing a stone here
          tempBoard.setAt(x, y, this.player);
          
          // Check if this is a winning move
          if (tempBoard.checkWin(x, y, this.player)) {
            return { x, y };
          }
          
          // Reset the position
          tempBoard.clearAt(x, y);
        }
      }
    }

    return null;
  }

  /**
   * Find a move to block the opponent from winning
   */
  private findBlockingMove(): Position | null {
    const boardState = this.board.getBoard();
    const tempBoard = new Board(boardState);

    // Check all empty positions
    for (let y = 0; y < boardState.length; y++) {
      for (let x = 0; x < boardState[y].length; x++) {
        if (boardState[y][x] === CellState.EMPTY) {
          // Try placing an opponent's stone here
          tempBoard.setAt(x, y, this.opponent);
          
          // Check if this would be a winning move for the opponent
          if (tempBoard.checkWin(x, y, this.opponent)) {
            return { x, y };
          }
          
          // Reset the position
          tempBoard.clearAt(x, y);
        }
      }
    }

    return null;
  }

  /**
   * Get a move for easy difficulty
   * Just picks a random position with neighbors
   */
  private getEasyMove(): Position | null {
    const positions = this.board.getEmptyPositionsWithNeighbors();
    
    if (positions.length === 0) {
      // If no positions with neighbors, return center position
      const center = Math.floor(this.board.getBoard().length / 2);
      return { x: center, y: center };
    }
    
    // Return a random position
    return positions[Math.floor(Math.random() * positions.length)];
  }

  /**
   * Get a move for medium difficulty
   * Uses simple position evaluation
   */
  private getMediumMove(): Position | null {
    const positions = this.board.getEmptyPositionsWithNeighbors();
    
    if (positions.length === 0) {
      // If no positions with neighbors, return center position
      const center = Math.floor(this.board.getBoard().length / 2);
      return { x: center, y: center };
    }
    
    // Evaluate each position
    const evaluatedPositions = positions.map(pos => ({
      position: pos,
      score: this.evaluatePosition(pos.x, pos.y)
    }));
    
    // Sort by score (highest first)
    evaluatedPositions.sort((a, b) => b.score - a.score);
    
    // Return the position with the highest score
    return evaluatedPositions[0].position;
  }

  /**
   * Get a move for hard difficulty
   * Uses more sophisticated position evaluation
   */
  private getHardMove(): Position | null {
    const positions = this.board.getEmptyPositionsWithNeighbors();
    
    if (positions.length === 0) {
      // If no positions with neighbors, return center position
      const center = Math.floor(this.board.getBoard().length / 2);
      return { x: center, y: center };
    }
    
    // Evaluate each position with higher weight for AI's advantage
    const evaluatedPositions = positions.map(pos => ({
      position: pos,
      score: this.evaluatePosition(pos.x, pos.y) * 1.5 - this.evaluatePositionForOpponent(pos.x, pos.y)
    }));
    
    // Sort by score (highest first)
    evaluatedPositions.sort((a, b) => b.score - a.score);
    
    // Return the position with the highest score
    return evaluatedPositions[0].position;
  }

  /**
   * Evaluate a position for the AI
   */
  private evaluatePosition(x: number, y: number): number {
    const boardState = this.board.getBoard();
    const tempBoard = new Board(boardState);
    
    // Place a stone at the position
    tempBoard.setAt(x, y, this.player);
    
    // Calculate score based on patterns in all directions
    let score = 0;
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1]   // diagonal up-right
    ];
    
    for (const [dx, dy] of directions) {
      score += this.evaluateDirection(tempBoard, x, y, dx, dy, this.player);
    }
    
    return score;
  }

  /**
   * Evaluate a position for the opponent
   */
  private evaluatePositionForOpponent(x: number, y: number): number {
    const boardState = this.board.getBoard();
    const tempBoard = new Board(boardState);
    
    // Place an opponent's stone at the position
    tempBoard.setAt(x, y, this.opponent);
    
    // Calculate score based on patterns in all directions
    let score = 0;
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1]   // diagonal up-right
    ];
    
    for (const [dx, dy] of directions) {
      score += this.evaluateDirection(tempBoard, x, y, dx, dy, this.opponent);
    }
    
    return score;
  }

  /**
   * Evaluate a direction for patterns
   */
  private evaluateDirection(board: Board, x: number, y: number, dx: number, dy: number, player: CellState): number {
    const pattern = this.getLinePattern(board, x, y, dx, dy, player);
    let score = 0;
    
    // Five in a row
    if (pattern.includes('OOOOO')) {
      score += 10000;
    }
    
    // Open four (can win in the next move)
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
   * Get a pattern string for a line in a specific direction
   */
  private getLinePattern(board: Board, x: number, y: number, dx: number, dy: number, player: CellState): string {
    const opponent = player === CellState.BLACK ? CellState.WHITE : CellState.BLACK;
    let pattern = '';
    
    // Check 9 positions (current + 4 in each direction)
    for (let i = -4; i <= 4; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      
      if (board.isValidPosition(nx, ny)) {
        const cell = board.getAt(nx, ny);
        if (cell === player) {
          pattern += 'O';
        } else if (cell === opponent) {
          pattern += 'X';
        } else {
          pattern += '.';
        }
      } else {
        pattern += 'X'; // Treat out-of-bounds as opponent's stones
      }
    }
    
    return pattern;
  }
}