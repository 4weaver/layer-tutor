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

test('default / primary board is the Lily58', () => {
  assert.equal(DEFAULT_BOARD_ID, 'lily58');
  assert.equal(PRIMARY_BOARD.id, 'lily58');
  assert.match(PRIMARY_BOARD.productName, /Lily58/i);
  assert.equal(PRIMARY_BOARD.geometry, 'lily58');
});

test('registry has one playable board and it resolves', () => {
  assert.ok(BOARDS.length >= 1);
  assert.ok(listPlayableBoards().every((b) => b.id && b.KEYS?.length));
  assert.equal(getBoard('missing-id').id, DEFAULT_BOARD_ID);
});

test('keyboardLayout facade matches the lily58 board matrix', () => {
  assert.equal(KEYS.length, PRIMARY_BOARD.KEYS.length);
  assert.deepEqual(charToKey('a'), PRIMARY_BOARD.charToKey('a'));
  assert.equal(PRIMARY_BOARD.positions?.['L31']?.x, 1);  // comma, left ring
});

test('board geometry: every key has a finite position within sane bounds', () => {
  const pos = PRIMARY_BOARD.positions || {};
  for (const k of PRIMARY_BOARD.KEYS) {
    const p = pos[k.id];
    assert.ok(p, 'missing position for ' + k.id);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), k.id);
    assert.ok(Math.abs(p.x) < 20 && Math.abs(p.y) < 20, k.id);
  }
  // space key is a wide/tall thumb key
  const space = pos['L42'];
  assert.ok(space.h > 1, 'space should be a tall thumb key');
  // bottom-right row aligns under the home row: B N M . / under H J K L ;
  assert.equal(pos['R30'].x, pos['R20'].x, 'B aligns with H');
  assert.equal(pos['R32'].x, pos['R22'].x, 'M aligns with K');
  assert.equal(pos['R34'].x, pos['R24'].x, '/ aligns with ;');
});

test('charToKey reflects the real ZMK keymap positions', () => {
  assert.deepEqual(charToKey('z'), { keyId: 'L32', layer: 0, shift: false });  // one column right of QWERTY
  assert.deepEqual(charToKey('b'), { keyId: 'R30', layer: 0, shift: false });  // right index-inner
  assert.deepEqual(charToKey(','), { keyId: 'L31', layer: 0, shift: false });  // tap of the NAV trigger
  assert.deepEqual(charToKey('\u2190'), { keyId: 'R20', layer: 1, shift: false });  // NAV: H
  assert.deepEqual(charToKey('\u21e4'), { keyId: 'R30', layer: 1, shift: false });  // NAV: B = HOME
});

test('NAV is held by the comma key; shift is the left home pinky', () => {
  assert.equal(PRIMARY_BOARD.assertUniqueCharMap(), true);
  assert.equal(PRIMARY_BOARD.LAYER_HOLD[1], 'L31');
  assert.deepEqual(PRIMARY_BOARD.SHIFT_KEYS, ['L20']);
});


test('lower-right row ids sit at cols 0-4, aligned under the home row', () => {
  for (const id of ['R30', 'R31', 'R32', 'R33', 'R34']) {
    const key = PRIMARY_BOARD.KEYS.find((k) => k.id === id);
    assert.ok(key, 'missing ' + id);
    assert.equal(key.col, Number(id[2]));
    assert.ok(key.col <= 4, id + ' should sit under the home row, not past ;');
  }
  assert.equal(PRIMARY_BOARD.charToKey('b').keyId, 'R30');
  assert.equal(PRIMARY_BOARD.charToKey('/').keyId, 'R34');
});
