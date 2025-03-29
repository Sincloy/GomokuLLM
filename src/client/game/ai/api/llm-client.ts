import { Board } from '../../board';
import { CellState, Position, Difficulty } from '../../types';
import { formatBoardForLLM } from './prompt-templates';

/**
 * LLM API Client
 * Handles communication with the Cloudflare Worker that makes API calls to LLMs
 */
export class LLMClient {
  private apiUrl: string;
  private board: Board;
  private player: CellState;
  private difficulty: Difficulty;

  constructor(
    board: Board, 
    player: CellState = CellState.WHITE, 
    difficulty: Difficulty = Difficulty.HARD,
    apiUrl: string = '/api/move'
  ) {
    this.board = board;
    this.player = player;
    this.difficulty = difficulty;
    this.apiUrl = apiUrl;
  }

  /**
   * Get the next move from the LLM API
   */
  async getMove(): Promise<Position | null> {
    try {
      const boardState = this.board.getBoard();
      
      // Make API request to the Cloudflare Worker
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          board: boardState,
          difficulty: this.difficulty
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.move) {
        throw new Error('Invalid API response');
      }
      
      return data.move;
    } catch (error) {
      console.error('Error getting move from LLM API:', error);
      return this.getFallbackMove();
    }
  }

  /**
   * Get a fallback move if the API call fails
   * This uses a simple strategy to ensure the game can continue
   */
  private getFallbackMove(): Position | null {
    console.log('Using fallback move strategy...');
    
    // First check for winning move
    const winningMove = this.findWinningMove();
    if (winningMove) {
      return winningMove;
    }
    
    // Then check for blocking move
    const blockingMove = this.findBlockingMove();
    if (blockingMove) {
      return blockingMove;
    }
    
    // Otherwise, find a random position with neighbors
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
   * Find a winning move
   */
  private findWinningMove(): Position | null {
    const boardState = this.board.getBoard();
    const tempBoard = new Board(boardState);
    const opponent = this.player === CellState.BLACK ? CellState.WHITE : CellState.BLACK;

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
    const opponent = this.player === CellState.BLACK ? CellState.WHITE : CellState.BLACK;

    // Check all empty positions
    for (let y = 0; y < boardState.length; y++) {
      for (let x = 0; x < boardState[y].length; x++) {
        if (boardState[y][x] === CellState.EMPTY) {
          // Try placing an opponent's stone here
          tempBoard.setAt(x, y, opponent);
          
          // Check if this would be a winning move for the opponent
          if (tempBoard.checkWin(x, y, opponent)) {
            return { x, y };
          }
          
          // Reset the position
          tempBoard.clearAt(x, y);
        }
      }
    }

    return null;
  }
}