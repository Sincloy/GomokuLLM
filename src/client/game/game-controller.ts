import { Board } from './board';
import { 
  CellState, 
  GameState, 
  GameSettings, 
  Position, 
  MoveHistory, 
  Difficulty, 
  FirstMove, 
  AIType,
  DEFAULT_SETTINGS,
  getInitialGameState
} from './types';
import { SimpleAI } from './ai/local/simple';
import { LLMClient } from './ai/api/llm-client';

/**
 * Game controller class
 * Manages the game state and handles user interactions
 */
export class GameController {
  private board: Board;
  private gameState: GameState;
  private settings: GameSettings;
  private onUpdateCallback: () => void;
  private onGameOverCallback: (winner: CellState | null) => void;
  private onThinkingCallback: (thinking: boolean) => void;

  constructor(
    settings: Partial<GameSettings> = {},
    onUpdate: () => void = () => {},
    onGameOver: (winner: CellState | null) => void = () => {},
    onThinking: (thinking: boolean) => void = () => {}
  ) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.gameState = getInitialGameState();
    this.board = new Board(this.gameState.board);
    this.onUpdateCallback = onUpdate;
    this.onGameOverCallback = onGameOver;
    this.onThinkingCallback = onThinking;
  }

  /**
   * Initialize the game
   */
  init(): void {
    this.resetGame();
  }

  /**
   * Reset the game
   */
  resetGame(): void {
    this.gameState = getInitialGameState();
    this.board = new Board(this.gameState.board);
    
    // Set the current player based on settings
    this.gameState.currentPlayer = this.settings.firstMove === FirstMove.PLAYER 
      ? CellState.BLACK 
      : CellState.WHITE;
    
    this.onUpdateCallback();
    
    // If AI goes first, make a move
    if (this.settings.firstMove === FirstMove.AI) {
      this.makeAIMove();
    }
  }

  /**
   * Handle a player move
   */
  async handlePlayerMove(x: number, y: number): Promise<boolean> {
    // Check if the game is over or it's not the player's turn
    if (this.gameState.gameOver || this.gameState.currentPlayer !== CellState.BLACK) {
      return false;
    }
    
    // Check if the move is valid
    if (!this.board.isValidMove(x, y)) {
      return false;
    }
    
    // Make the move
    this.makeMove(x, y, CellState.BLACK);
    
    // Check if the game is over
    if (!this.checkGameEnd()) {
      // AI's turn
      await this.makeAIMove();
    }
    
    return true;
  }

  /**
   * Make a move
   */
  private makeMove(x: number, y: number, player: CellState): void {
    // Update the board
    this.board.setAt(x, y, player);
    
    // Update the game state
    this.gameState.lastMove = { x, y };
    this.gameState.history.push({ x, y, player });
    this.gameState.currentPlayer = player === CellState.BLACK ? CellState.WHITE : CellState.BLACK;
    
    // Update the board in the game state
    this.gameState.board = this.board.getBoard();
    
    // Notify listeners
    this.onUpdateCallback();
  }

  /**
   * Make an AI move
   */
  private async makeAIMove(): Promise<void> {
    // Notify that AI is thinking
    this.onThinkingCallback(true);
    
    try {
      // Get the AI move based on the selected AI type
      let move: Position | null = null;
      
      if (this.settings.aiType === AIType.LOCAL) {
        // Use local AI
        const ai = new SimpleAI(this.board, CellState.WHITE, this.settings.difficulty);
        move = ai.getMove();
      } else {
        // Use LLM API
        const llmClient = new LLMClient(this.board, CellState.WHITE, this.settings.difficulty);
        move = await llmClient.getMove();
        // ai投降
        if (move && move.x === -1 && move.y === -1) {
          this.gameState.gameOver = true;
          this.gameState.winner = CellState.WHITE;
          this.onGameOverCallback(CellState.SURRENDER);
          return;
        }
      }
      
      // Make the move if valid
      if (move && this.board.isValidMove(move.x, move.y)) {
        this.makeMove(move.x, move.y, CellState.WHITE);
        
        // Check if the game is over
        this.checkGameEnd();
      } else {
        console.error('AI returned an invalid move:', move);
        
        // Fallback to a random valid move
        const validPositions = this.board.getEmptyPositionsWithNeighbors();
        if (validPositions.length > 0) {
          const randomMove = validPositions[Math.floor(Math.random() * validPositions.length)];
          this.makeMove(randomMove.x, randomMove.y, CellState.WHITE);
          this.checkGameEnd();
        }
      }
    } catch (error) {
      console.error('Error making AI move:', error);
    } finally {
      // Notify that AI is done thinking
      this.onThinkingCallback(false);
    }
  }

  /**
   * Check if the game has ended
   */
  private checkGameEnd(): boolean {
    // Check if the last move resulted in a win
    if (this.gameState.lastMove) {
      const { x, y } = this.gameState.lastMove;
      const lastPlayer = this.board.getAt(x, y);
      
      if (this.board.checkWin(x, y, lastPlayer)) {
        this.gameState.gameOver = true;
        this.gameState.winner = lastPlayer;
        this.onGameOverCallback(lastPlayer);
        return true;
      }
    }
    
    // Check for a draw (board is full)
    if (this.board.isFull()) {
      this.gameState.gameOver = true;
      this.gameState.winner = null;
      this.onGameOverCallback(null);
      return true;
    }
    
    return false;
  }

  /**
   * Undo the last move (both player and AI)
   */
  undoMove(): boolean {
    // Need at least 2 moves to undo (player and AI)
    if (this.gameState.history.length < 2) {
      return false;
    }
    
    // Remove the last two moves
    this.gameState.history.pop(); // AI move
    this.gameState.history.pop(); // Player move
    
    // Reset the board
    this.board.reset();
    
    // Replay the history
    for (const move of this.gameState.history) {
      this.board.setAt(move.x, move.y, move.player);
    }
    
    // Update the game state
    this.gameState.board = this.board.getBoard();
    this.gameState.currentPlayer = CellState.BLACK; // Always player's turn after undo
    this.gameState.gameOver = false;
    this.gameState.winner = null;
    
    // Set the last move
    if (this.gameState.history.length > 0) {
      const lastMove = this.gameState.history[this.gameState.history.length - 1];
      this.gameState.lastMove = { x: lastMove.x, y: lastMove.y };
    } else {
      this.gameState.lastMove = null;
    }
    
    // Notify listeners
    this.onUpdateCallback();
    
    return true;
  }

  /**
   * Get the winning stones
   */
  getWinningStones(): Position[] {
    if (this.gameState.gameOver && this.gameState.winner && this.gameState.lastMove) {
      const { x, y } = this.gameState.lastMove;
      return this.board.getWinningStones(x, y, this.gameState.winner);
    }
    return [];
  }

  /**
   * Update game settings
   */
  updateSettings(newSettings: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get the current game state
   */
  getGameState(): GameState {
    return { ...this.gameState };
  }

  /**
   * Get the current settings
   */
  getSettings(): GameSettings {
    return { ...this.settings };
  }

  /**
   * Get move history in readable format
   */
  getMoveHistoryText(): string[] {
    return this.gameState.history.map((move, index) => {
      const playerText = move.player === CellState.BLACK ? '黑棋' : '白棋';
      const coordinates = `(${move.x + 1}, ${move.y + 1})`;
      return `${index + 1}. ${playerText} ${coordinates}`;
    });
  }
}