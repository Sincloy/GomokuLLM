import './styles/main.css';
import { GameController } from './game/game-controller';
import { BoardRenderer } from './ui/board-renderer';
import { UIController } from './ui/ui-controller';
import { Difficulty, FirstMove, AIType } from './game/types';

/**
 * Initialize the application when the DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const boardElement = document.getElementById('board') as HTMLElement;
  const currentPlayerElement = document.getElementById('current-player') as HTMLElement;
  const gameStatusElement = document.getElementById('game-status') as HTMLElement;
  const restartButton = document.getElementById('restart-btn') as HTMLElement;
  const undoButton = document.getElementById('undo-btn') as HTMLButtonElement;
  const gameEndModal = document.getElementById('game-end-modal') as HTMLElement;
  const modalTitle = document.getElementById('modal-title') as HTMLElement;
  const modalMessage = document.getElementById('modal-message') as HTMLElement;
  const modalClose = document.getElementById('modal-close') as HTMLElement;
  const modalRestart = document.getElementById('modal-restart') as HTMLElement;
  const thinkingIndicator = document.getElementById('thinking-indicator') as HTMLElement;
  const gameHistory = document.getElementById('game-history') as HTMLElement;
  const settingsToggle = document.getElementById('settings-toggle') as HTMLElement;
  const settingsPanel = document.getElementById('settings-panel') as HTMLElement;
  const difficultyButtons = document.querySelectorAll('.difficulty-btn') as NodeListOf<HTMLElement>;
  const firstMoveButtons = document.querySelectorAll('.first-move-btn') as NodeListOf<HTMLElement>;
  const aiTypeButtons = document.querySelectorAll('.ai-type-btn') as NodeListOf<HTMLElement>;

  // Check if all elements exist
  if (!boardElement || !currentPlayerElement || !gameStatusElement || !restartButton || 
      !undoButton || !gameEndModal || !modalTitle || !modalMessage || !modalClose || 
      !modalRestart || !thinkingIndicator || !gameHistory || !settingsToggle || 
      !settingsPanel || !difficultyButtons || !firstMoveButtons || !aiTypeButtons) {
    console.error('Could not find all required DOM elements');
    return;
  }

  // Get initial settings from UI
  const initialSettings = {
    difficulty: getDifficultyFromUI(difficultyButtons),
    firstMove: getFirstMoveFromUI(firstMoveButtons),
    aiType: getAITypeFromUI(aiTypeButtons)
  };

  // Create game controller
  const gameController = new GameController(
    initialSettings,
    // Update callback
    () => {
      boardRenderer.updateBoard();
      uiController.updateUndoButtonState();
    },
    // Game over callback
    (winner) => {
      uiController.showGameEndModal(winner);
    },
    // Thinking callback
    (thinking) => {
      boardRenderer.showThinking(thinking);
    }
  );

  // Create board renderer
  const boardRenderer = new BoardRenderer(
    gameController,
    boardElement,
    currentPlayerElement,
    gameStatusElement,
    thinkingIndicator,
    gameHistory
  );

  // Create UI controller
  const uiController = new UIController(
    gameController,
    boardRenderer,
    {
      restartButton,
      undoButton,
      gameEndModal,
      modalTitle,
      modalMessage,
      modalClose,
      modalRestart,
      settingsToggle,
      settingsPanel,
      difficultyButtons,
      firstMoveButtons,
      aiTypeButtons
    }
  );

  // Initialize the UI
  uiController.init();

  // Helper functions to get initial settings from UI
  function getDifficultyFromUI(buttons: NodeListOf<HTMLElement>): Difficulty {
    for (const button of Array.from(buttons)) {
      if (button.classList.contains('bg-blue-100')) {
        return button.dataset.difficulty as Difficulty || Difficulty.HARD;
      }
    }
    return Difficulty.HARD;
  }

  function getFirstMoveFromUI(buttons: NodeListOf<HTMLElement>): FirstMove {
    for (const button of Array.from(buttons)) {
      if (button.classList.contains('bg-blue-100')) {
        return button.dataset.first as FirstMove || FirstMove.PLAYER;
      }
    }
    return FirstMove.PLAYER;
  }

  function getAITypeFromUI(buttons: NodeListOf<HTMLElement>): AIType {
    for (const button of Array.from(buttons)) {
      if (button.classList.contains('bg-blue-100')) {
        return button.dataset.type as AIType || AIType.LOCAL;
      }
    }
    return AIType.LOCAL;
  }
});