import { CellState, Position, BOARD_SIZE } from './types';

/**
 * Board class to handle the game board logic
 */
export class Board {
  private board: CellState[][];

  constructor(initialBoard?: CellState[][]) {
    if (initialBoard) {
      this.board = initialBoard;
    } else {
      this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(CellState.EMPTY));
    }
  }

  /**
   * Get the current board state
   */
  getBoard(): CellState[][] {
    return this.board.map(row => [...row]);
  }

  /**
   * Get the value at a specific position
   */
  getAt(x: number, y: number): CellState {
    if (this.isValidPosition(x, y)) {
      return this.board[y][x];
    }
    return CellState.EMPTY;
  }

  /**
   * Set a value at a specific position
   */
  setAt(x: number, y: number, value: CellState): boolean {
    if (this.isValidPosition(x, y) && this.board[y][x] === CellState.EMPTY) {
      this.board[y][x] = value;
      return true;
    }
    return false;
  }

  /**
   * Clear a specific position
   */
  clearAt(x: number, y: number): void {
    if (this.isValidPosition(x, y)) {
      this.board[y][x] = CellState.EMPTY;
    }
  }

  /**
   * Reset the board
   */
  reset(): void {
    this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(CellState.EMPTY));
  }

  /**
   * Check if a position is valid
   */
  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
  }

  /**
   * Check if a move is valid
   */
  isValidMove(x: number, y: number): boolean {
    return this.isValidPosition(x, y) && this.board[y][x] === CellState.EMPTY;
  }

  /**
   * Check if a player has won at a specific position
   */
  checkWin(x: number, y: number, player: CellState): boolean {
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
        
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Count in the opposite direction
      for (let i = 1; i <= 4; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] === player) {
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
   * Get winning stones positions
   */
  getWinningStones(x: number, y: number, player: CellState): Position[] {
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1]   // diagonal up-right
    ];
    
    for (const [dx, dy] of directions) {
      let stones: Position[] = [];
      stones.push({ x, y });
      
      // Check in one direction
      for (let i = 1; i <= 4; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] === player) {
          stones.push({ x: nx, y: ny });
        } else {
          break;
        }
      }
      
      // Check in the opposite direction
      for (let i = 1; i <= 4; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] === player) {
          stones.push({ x: nx, y: ny });
        } else {
          break;
        }
      }
      
      if (stones.length >= 5) {
        return stones;
      }
    }
    
    return [];
  }

  /**
   * Check if the board is full
   */
  isFull(): boolean {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this.board[y][x] === CellState.EMPTY) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Check if a position has neighboring stones
   */
  hasNeighbor(x: number, y: number, range: number = 2): boolean {
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidPosition(nx, ny) && this.board[ny][nx] !== CellState.EMPTY) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get all empty positions with neighbors
   */
  getEmptyPositionsWithNeighbors(range: number = 2): Position[] {
    const positions: Position[] = [];
    
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this.board[y][x] === CellState.EMPTY && this.hasNeighbor(x, y, range)) {
          positions.push({ x, y });
        }
      }
    }
    
    return positions;
  }
}