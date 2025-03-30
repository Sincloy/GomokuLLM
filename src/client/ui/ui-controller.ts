import { GameController } from '../game/game-controller';
import { BoardRenderer } from './board-renderer';
import { Difficulty, FirstMove, AIType, GameSettings } from '../game/types';

/**
 * UI Controller class
 * Handles UI interactions and connects the game controller with the UI renderer
 */
export class UIController {
  private gameController: GameController;
  private boardRenderer: BoardRenderer;
  
  // UI Elements
  private restartButton: HTMLElement;
  private undoButton: HTMLButtonElement; // Changed to HTMLButtonElement for disabled property
  private gameEndModal: HTMLElement;
  private modalTitle: HTMLElement;
  private modalMessage: HTMLElement;
  private modalClose: HTMLElement;
  private modalRestart: HTMLElement;
  private settingsToggle: HTMLElement;
  private settingsPanel: HTMLElement;
  private difficultyButtons: NodeListOf<HTMLElement>;
  private firstMoveButtons: NodeListOf<HTMLElement>;
  private aiTypeButtons: NodeListOf<HTMLElement>;

  constructor(
    gameController: GameController,
    boardRenderer: BoardRenderer,
    elements: {
      restartButton: HTMLElement;
      undoButton: HTMLButtonElement; // Changed to HTMLButtonElement
      gameEndModal: HTMLElement;
      modalTitle: HTMLElement;
      modalMessage: HTMLElement;
      modalClose: HTMLElement;
      modalRestart: HTMLElement;
      settingsToggle: HTMLElement;
      settingsPanel: HTMLElement;
      difficultyButtons: NodeListOf<HTMLElement>;
      firstMoveButtons: NodeListOf<HTMLElement>;
      aiTypeButtons: NodeListOf<HTMLElement>;
    }
  ) {
    this.gameController = gameController;
    this.boardRenderer = boardRenderer;
    
    // Assign UI elements
    this.restartButton = elements.restartButton;
    this.undoButton = elements.undoButton;
    this.gameEndModal = elements.gameEndModal;
    this.modalTitle = elements.modalTitle;
    this.modalMessage = elements.modalMessage;
    this.modalClose = elements.modalClose;
    this.modalRestart = elements.modalRestart;
    this.settingsToggle = elements.settingsToggle;
    this.settingsPanel = elements.settingsPanel;
    this.difficultyButtons = elements.difficultyButtons;
    this.firstMoveButtons = elements.firstMoveButtons;
    this.aiTypeButtons = elements.aiTypeButtons;
  }

  /**
   * Initialize the UI
   */
  init(): void {
    // Initialize the board renderer
    this.boardRenderer.initBoard();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize the game controller
    this.gameController.init();
    
    // Update the UI
    this.boardRenderer.updateBoard();
    this.updateUndoButtonState();
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Restart button
    this.restartButton.addEventListener('click', () => this.handleRestart());
    
    // Undo button
    this.undoButton.addEventListener('click', () => this.handleUndo());
    
    // Modal buttons
    this.modalClose.addEventListener('click', () => this.hideGameEndModal());
    this.modalRestart.addEventListener('click', () => {
      this.hideGameEndModal();
      this.handleRestart();
    });
    
    // Settings toggle
    this.settingsToggle.addEventListener('click', () => this.toggleSettingsPanel());
    
    // Difficulty buttons
    this.difficultyButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.updateDifficultyButtons(button);
        const difficulty = button.dataset.difficulty as Difficulty;
        this.gameController.updateSettings({ difficulty });
      });
    });
    
    // First move buttons
    this.firstMoveButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.updateFirstMoveButtons(button);
        const firstMove = button.dataset.first as FirstMove;
        this.gameController.updateSettings({ firstMove });
      });
    });
    
    // AI type buttons
    this.aiTypeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.updateAITypeButtons(button);
        const aiType = button.dataset.type as AIType;
        this.gameController.updateSettings({ aiType });
      });
    });
  }

  /**
   * Handle restart
   */
  private handleRestart(): void {
    this.gameController.resetGame();
    this.boardRenderer.updateBoard();
    this.updateUndoButtonState();
  }

  /**
   * Handle undo
   */
  private handleUndo(): void {
    if (this.gameController.undoMove()) {
      this.boardRenderer.updateBoard();
      this.updateUndoButtonState();
    }
  }

  /**
   * Update undo button state
   * Made public so it can be called from the game controller update callback
   */
  public updateUndoButtonState(): void {
    const gameState = this.gameController.getGameState();
    const disabled = gameState.history.length < 2;
    
    this.undoButton.disabled = disabled;
    
    if (disabled) {
      this.undoButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      this.undoButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  /**
   * Show game end modal
   */
  showGameEndModal(winner: number | null): void {
    let title = '游戏结束';
    let message = '';
    
    if (winner === 1) {
      title = '胜利！';
      message = '恭喜，你赢了！';
    } else if (winner === 2) {
      title = '失败！';
      message = 'AI获胜了，再接再厉！';
    } else if (winner === 3) {
      title = '对手投降 😢';
      message = 'AI认输了，你太厉害了！';
    } else {
      title = '平局';
      message = '棋盘已满，双方平局！';
    }
    
    this.modalTitle.textContent = title;
    this.modalMessage.textContent = message;
    this.gameEndModal.classList.remove('hidden');
  }

  /**
   * Hide game end modal
   */
  private hideGameEndModal(): void {
    this.gameEndModal.classList.add('hidden');
  }

  /**
   * Toggle settings panel
   */
  private toggleSettingsPanel(): void {
    this.settingsPanel.classList.toggle('h-0');
    this.settingsPanel.classList.toggle('overflow-hidden');
    this.settingsPanel.classList.toggle('opacity-0');
    
    // Update icon
    const icon = this.settingsToggle.querySelector('svg');
    if (icon) {
      if (this.settingsPanel.classList.contains('h-0')) {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
      } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
      }
    }
  }

  /**
   * Update difficulty buttons
   */
  private updateDifficultyButtons(selectedButton: HTMLElement): void {
    this.difficultyButtons.forEach(btn => {
      btn.classList.remove('bg-blue-100', 'border-blue-500');
      btn.classList.add('bg-gray-100');
    });
    
    selectedButton.classList.remove('bg-gray-100');
    selectedButton.classList.add('bg-blue-100', 'border-blue-500');
  }

  /**
   * Update first move buttons
   */
  private updateFirstMoveButtons(selectedButton: HTMLElement): void {
    this.firstMoveButtons.forEach(btn => {
      btn.classList.remove('bg-blue-100', 'border-blue-500');
      btn.classList.add('bg-gray-100');
    });
    
    selectedButton.classList.remove('bg-gray-100');
    selectedButton.classList.add('bg-blue-100', 'border-blue-500');
  }

  /**
   * Update AI type buttons
   */
  private updateAITypeButtons(selectedButton: HTMLElement): void {
    this.aiTypeButtons.forEach(btn => {
      btn.classList.remove('bg-blue-100', 'border-blue-500');
      btn.classList.add('bg-gray-100');
    });
    
    selectedButton.classList.remove('bg-gray-100');
    selectedButton.classList.add('bg-blue-100', 'border-blue-500');
  }
}