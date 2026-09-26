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

test('default / primary board is Eyelash Sofle', () => {
  assert.equal(DEFAULT_BOARD_ID, 'eyelash-sofle');
  assert.equal(PRIMARY_BOARD.id, 'eyelash-sofle');
  assert.match(PRIMARY_BOARD.productName, /Eyelash Sofle/i);
  assert.match(PRIMARY_BOARD.formFactor, /Sofle|split/i);
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[1], 'L41'); // Space → Nav
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[2], 'R40'); // Enter → Sym
});

test('board labels include product identity for sharing', () => {
  const b = getBoard('eyelash-sofle');
  assert.match(boardLabel(b), /Eyelash Sofle/);
  assert.match(boardFullLabel(b), /Eyelash Sofle/);
  const corne = getBoard('corne-v4');
  assert.match(boardLabel(corne), /Corne V4/);
  assert.match(boardFullLabel(corne), /CORNE V4 Wired Split Mechanical Keyboard/);
});

test('registry has Eyelash + Corne and all playable boards resolve', () => {
  assert.ok(BOARDS.length >= 2);
  assert.ok(listPlayableBoards().some((b) => b.id === 'eyelash-sofle'));
  assert.ok(listPlayableBoards().some((b) => b.id === 'corne-v4'));
  assert.ok(listPlayableBoards().every((b) => b.id && b.KEYS?.length));
  assert.equal(getBoard('missing-id').id, DEFAULT_BOARD_ID);
});

test('keyboardLayout facade matches the Eyelash board matrix', () => {
  assert.equal(KEYS.length, PRIMARY_BOARD.KEYS.length);
  assert.deepEqual(charToKey('a'), PRIMARY_BOARD.charToKey('a'));
  assert.equal(PRIMARY_BOARD.vilPath, null);
  assert.equal(PRIMARY_BOARD.geometry, 'eyelash-sofle');
  assert.ok(PRIMARY_BOARD.positions?.L41);
});

test('Eyelash CHAR_MAP is unique and maps Space/Enter holds', () => {
  assert.equal(PRIMARY_BOARD.assertUniqueCharMap(), true);
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[1], 'L41');
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[2], 'R40');
  assert.equal(PRIMARY_BOARD.charToKey('1').layer, 0); // base number row
  assert.equal(PRIMARY_BOARD.charToKey('←').layer, 1);
  assert.equal(PRIMARY_BOARD.charToKey('!').layer, 2);
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
