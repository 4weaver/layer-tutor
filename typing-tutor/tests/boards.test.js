import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS,
  DEFAULT_BOARD_ID,
  getBoard,
  listPlayableBoards,
  boardFullLabel,
  boardLabel,
} from '../js/boards/index.js';
import { PRIMARY_BOARD, KEYS, charToKey } from '../js/keyboardLayout.js';
import { createLayout, boardFromDeclaration } from '../js/boards/buildLayout.js';

test('default / primary board is Corne V4', () => {
  assert.equal(DEFAULT_BOARD_ID, 'corne-v4');
  assert.equal(PRIMARY_BOARD.id, 'corne-v4');
  assert.match(PRIMARY_BOARD.productName, /CORNE V4/i);
  assert.match(PRIMARY_BOARD.formFactor, /3×6|3x6/i);
  assert.match(PRIMARY_BOARD.formFactor, /ortho/i);
});

test('board labels include product identity for sharing', () => {
  const b = getBoard('corne-v4');
  assert.match(boardLabel(b), /Corne V4/);
  assert.match(boardFullLabel(b), /CORNE V4 Wired Split Mechanical Keyboard/);
  assert.match(boardFullLabel(b), /40%/);
});

test('registry has at least the Corne and all playable boards resolve', () => {
  assert.ok(BOARDS.length >= 1);
  assert.ok(listPlayableBoards().every((b) => b.id && b.KEYS?.length));
  assert.equal(getBoard('missing-id').id, DEFAULT_BOARD_ID);
});

test('keyboardLayout facade matches the Corne board matrix', () => {
  assert.equal(KEYS.length, PRIMARY_BOARD.KEYS.length);
  assert.deepEqual(charToKey('a'), PRIMARY_BOARD.charToKey('a'));
  assert.equal(PRIMARY_BOARD.vilPath, 'layouts/corne-v4.vil');
  assert.equal(PRIMARY_BOARD.geometry, 'corne-3x6');
});

test('Corne CHAR_MAP is unique and maps hold layers', () => {
  assert.equal(PRIMARY_BOARD.assertUniqueCharMap(), true);
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[1], 'L34');
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[2], 'R34');
});

test('hold-tap keys still map their base-layer tap legend', () => {
  // Minimal ZMK-style hold-tap: comma tap / NAV hold on L31.
  const left = [
    [['L24', 'F', null, null]],
    [['L31', ',', '←', null]],
  ];
  const right = [
    [['R20', 'H', '←', null]],
  ];
  const layout = createLayout({
    left,
    right,
    layerHold: { 1: 'L31' },
    shiftKeys: [],
    spaceKeyId: null,
  });
  assert.deepEqual(layout.charToKey(','), { keyId: 'L31', layer: 0, shift: false });
  // Held-layer legend on the hold key itself is not a typeable char mapping.
  assert.equal(layout.charToKey('←')?.keyId, 'R20');
});

test('boardFromDeclaration builds a registerable board from JSON-shaped decl', () => {
  const decl = {
    id: 'tiny',
    name: 'Tiny',
    homeIds: ['L00'],
    positions: { L00: { x: 0, y: 0 }, R00: { x: 0, y: 0 } },
    left: [[['L00', 'A', null, null]]],
    right: [[['R00', 'B', null, null]]],
    layerHold: {},
    shiftKeys: [],
  };
  const board = boardFromDeclaration(decl);
  assert.equal(board.id, 'tiny');
  assert.deepEqual(board.charToKey('a'), { keyId: 'L00', layer: 0, shift: false });
  assert.deepEqual(board.homeIds, ['L00']);
  assert.equal(board.positions.L00.x, 0);
  assert.equal(board.assertUniqueCharMap(), true);
});
