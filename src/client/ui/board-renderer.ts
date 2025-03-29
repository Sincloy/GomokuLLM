import { GameController } from '../game/game-controller';
import { CellState, Position } from '../game/types';

/**
 * Board renderer class
 * Handles rendering the game board and UI elements
 */
export class BoardRenderer {
  private gameController: GameController;
  private boardElement: HTMLElement;
  private currentPlayerElement: HTMLElement;
  private gameStatusElement: HTMLElement;
  private thinkingIndicator: HTMLElement;
  private gameHistory: HTMLElement;
  private boardSize: number = 15;

  constructor(
    gameController: GameController,
    boardElement: HTMLElement,
    currentPlayerElement: HTMLElement,
    gameStatusElement: HTMLElement,
    thinkingIndicator: HTMLElement,
    gameHistory: HTMLElement
  ) {
    this.gameController = gameController;
    this.boardElement = boardElement;
    this.currentPlayerElement = currentPlayerElement;
    this.gameStatusElement = gameStatusElement;
    this.thinkingIndicator = thinkingIndicator;
    this.gameHistory = gameHistory;
  }

  /**
   * Initialize the board
   */
  initBoard(): void {
    this.boardElement.innerHTML = '';
    
    // Create the intersections
    for (let y = 0; y < this.boardSize; y++) {
      for (let x = 0; x < this.boardSize; x++) {
        const intersection = document.createElement('div');
        intersection.className = 'intersection';
        intersection.dataset.x = x.toString();
        intersection.dataset.y = y.toString();
        
        // Add star points
        if ((x === 3 || x === 7 || x === 11) && (y === 3 || y === 7 || y === 11)) {
          intersection.classList.add('star-point');
        }
        
        // Add click event
        intersection.addEventListener('click', () => this.handleIntersectionClick(x, y));
        
        this.boardElement.appendChild(intersection);
      }
    }
  }

  /**
   * Handle intersection click
   */
  private async handleIntersectionClick(x: number, y: number): Promise<void> {
    await this.gameController.handlePlayerMove(x, y);
  }

  /**
   * Update the board display
   */
  updateBoard(): void {
    const gameState = this.gameController.getGameState();
    
    // Clear all stones
    const stones = this.boardElement.querySelectorAll('.stone');
    stones.forEach(stone => stone.remove());
    
    // Clear last move marker
    const lastMoveMarker = this.boardElement.querySelector('.last-move');
    if (lastMoveMarker) {
      lastMoveMarker.classList.remove('last-move');
    }
    
    // Add stones
    for (let y = 0; y < this.boardSize; y++) {
      for (let x = 0; x < this.boardSize; x++) {
        const value = gameState.board[y][x];
        if (value !== CellState.EMPTY) {
          const index = y * this.boardSize + x;
          const intersection = this.boardElement.children[index] as HTMLElement;
          
          if (intersection) {
            const stone = document.createElement('div');
            stone.className = 'stone ' + (value === CellState.BLACK ? 'black' : 'white');
            intersection.appendChild(stone);
          }
        }
      }
    }
    
    // Mark last move
    if (gameState.lastMove) {
      const { x, y } = gameState.lastMove;
      const index = y * this.boardSize + x;
      if (index >= 0 && index < this.boardElement.children.length) {
        this.boardElement.children[index].classList.add('last-move');
      }
    }
    
    // Update current player display
    this.currentPlayerElement.innerHTML = gameState.currentPlayer === CellState.BLACK
      ? '<div class="w-6 h-6 rounded-full bg-black mr-2"></div><span>黑棋 (你)</span>'
      : '<div class="w-6 h-6 rounded-full bg-white border border-gray-300 mr-2"></div><span>白棋 (AI)</span>';
    
    // Update game status
    if (gameState.gameOver) {
      let statusText = '游戏结束';
      if (gameState.winner === CellState.BLACK) {
        statusText = '黑棋胜利！';
      } else if (gameState.winner === CellState.WHITE) {
        statusText = '白棋胜利！';
      } else {
        statusText = '平局';
      }
      this.gameStatusElement.textContent = statusText;
      this.gameStatusElement.className = 'text-red-600 font-medium';
      
      // Highlight winning stones
      this.highlightWinningStones();
    } else {
      this.gameStatusElement.textContent = '进行中';
      this.gameStatusElement.className = 'text-green-600 font-medium';
    }
    
    // Update game history
    this.updateGameHistory();
  }

  /**
   * Highlight winning stones
   */
  private highlightWinningStones(): void {
    const winningStones = this.gameController.getWinningStones();
    
    for (const stone of winningStones) {
      const index = stone.y * this.boardSize + stone.x;
      if (index >= 0 && index < this.boardElement.children.length) {
        const stoneElement = this.boardElement.children[index].querySelector('.stone');
        if (stoneElement) {
          stoneElement.classList.add('winning');
        }
      }
    }
  }

  /**
   * Update game history display
   */
  private updateGameHistory(): void {
    const historyTexts = this.gameController.getMoveHistoryText();
    
    this.gameHistory.innerHTML = '';
    
    historyTexts.forEach(text => {
      const historyItem = document.createElement('div');
      historyItem.textContent = text;
      this.gameHistory.appendChild(historyItem);
    });
    
    // Scroll to bottom
    this.gameHistory.scrollTop = this.gameHistory.scrollHeight;
  }

  /**
   * Show thinking indicator
   */
  showThinking(thinking: boolean): void {
    if (thinking) {
      this.thinkingIndicator.classList.remove('hidden');
    } else {
      this.thinkingIndicator.classList.add('hidden');
    }
  }
}