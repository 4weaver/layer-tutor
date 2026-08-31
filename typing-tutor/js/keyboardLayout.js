// Compatibility facade over the active/default board.
// This fork ships a single board: lily58 (generated from the ZMK keymap).

import { board as lily58 } from './boards/lily58.js';
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

export const PRIMARY_BOARD = lily58;

export const KEYS = lily58.KEYS;
export const LAYER_HOLD = lily58.LAYER_HOLD;
export const SHIFT_KEYS = lily58.SHIFT_KEYS;
export const SHIFT_KEY = lily58.SHIFT_KEY;

export function charToKey(ch) {
  return lily58.charToKey(ch);
}

export function shiftKeysFor(target) {
  return lily58.shiftKeysFor(target);
}

export function assertUniqueCharMap() {
  return lily58.assertUniqueCharMap();
}

export function layoutSnapshot() {
  return lily58.KEYS.map((k) => ({
    id: k.id,
    half: k.half,
    row: k.row,
    col: k.col,
    legends: { ...k.legends },
  }));
}
