// Compatibility facade over the active/default board.
// Prefer importing from ./boards/index.js when you need multi-board awareness.
//
// Default exports resolve to the fork primary board (Eyelash Sofle) so curriculum
// tests and the layout-check script stay aligned with DEFAULT_BOARD_ID.

import { board as eyelashSofle } from './boards/eyelash-sofle.js';
import {
  BOARDS,
  DEFAULT_BOARD_ID,
  getBoard,
  listBoards,
  listPlayableBoards,
  boardLabel,
  boardFullLabel,
} from './boards/index.js';

export {
  BOARDS,
  DEFAULT_BOARD_ID,
  getBoard,
  listBoards,
  listPlayableBoards,
  boardLabel,
  boardFullLabel,
};

/** Currently documented primary board for this fork. */
export const PRIMARY_BOARD = eyelashSofle;

export const KEYS = eyelashSofle.KEYS;
export const LAYER_HOLD = eyelashSofle.LAYER_HOLD;
export const SHIFT_KEYS = eyelashSofle.SHIFT_KEYS;
export const SHIFT_KEY = eyelashSofle.SHIFT_KEY;

export function charToKey(ch) {
  return eyelashSofle.charToKey(ch);
}

export function shiftKeysFor(target) {
  return eyelashSofle.shiftKeysFor(target);
}

export function assertUniqueCharMap() {
  return eyelashSofle.assertUniqueCharMap();
}

export function layoutSnapshot() {
  return eyelashSofle.KEYS.map((k) => ({
    id: k.id,
    half: k.half,
    row: k.row,
    col: k.col,
    legends: { ...k.legends },
  }));
}
