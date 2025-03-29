/**
 * Game constants and types
 */

// Board cell states
export enum CellState {
  EMPTY = 0,
  BLACK = 1,
  WHITE = 2
}

// Game difficulty levels
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

// First move options
export enum FirstMove {
  PLAYER = 'player',
  AI = 'ai'
}

// AI type options
export enum AIType {
  LOCAL = 'local',
  LLM = 'llm'
}

// Position on the board
export interface Position {
  x: number;
  y: number;
}

// Move history entry
export interface MoveHistory {
  x: number;
  y: number;
  player: CellState;
}

// Game settings
export interface GameSettings {
  difficulty: Difficulty;
  firstMove: FirstMove;
  aiType: AIType;
}

// Game state
export interface GameState {
  board: CellState[][];
  currentPlayer: CellState;
  gameOver: boolean;
  winner: CellState | null;
  history: MoveHistory[];
  lastMove: Position | null;
}

// Board size
export const BOARD_SIZE = 15;

// Default game settings
export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: Difficulty.HARD,
  firstMove: FirstMove.PLAYER,
  aiType: AIType.LOCAL
};

// Default game state
export const getInitialGameState = (): GameState => ({
  board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(CellState.EMPTY)),
  currentPlayer: CellState.BLACK,
  gameOver: false,
  winner: null,
  history: [],
  lastMove: null
});