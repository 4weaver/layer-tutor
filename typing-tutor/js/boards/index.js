// Board registry. Add future models here (Iris, Lily58, custom, …) and they
// appear in the menu selector automatically.

import { board as corneV4 } from './corne-v4.js';
import { board as eyelashSofle } from './eyelash-sofle.js';

/**
 * Playable boards only. When you add a new model:
 *  1. Drop its Vial export in layouts/<id>.vil (or generate from ZMK)
 *  2. Create js/boards/<id>.js via createLayout / boardFromDeclaration
 *  3. Import and push it onto BOARDS below
 *  4. Extend scripts/check-layout.mjs if the matrix shape differs (Vial only)
 *
 * This fork defaults to Eyelash Sofle (ZMK). Corne V4 stays loadable.
 */
export const BOARDS = [eyelashSofle, corneV4];

export const DEFAULT_BOARD_ID = 'eyelash-sofle';

export function listBoards() {
  return BOARDS;
}

export function listPlayableBoards() {
  return BOARDS.filter((b) => !b.comingSoon);
}

export function getBoard(id) {
  const playable = listPlayableBoards();
  return playable.find((b) => b.id === id)
    ?? playable.find((b) => b.id === DEFAULT_BOARD_ID)
    ?? playable[0];
}

export function boardLabel(board) {
  if (!board) return '';
  return `${board.name} · ${board.formFactor}`;
}

export function boardFullLabel(board) {
  if (!board) return '';
  return `${board.productName}, ${board.formFactor}`;
}
