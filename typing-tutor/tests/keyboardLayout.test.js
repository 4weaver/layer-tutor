import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  charToKey, KEYS, LAYER_HOLD, SHIFT_KEY, SHIFT_KEYS,
  assertUniqueCharMap, shiftKeysFor,
} from '../js/keyboardLayout.js';

test('base-layer letters map to layer 0 without shift', () => {
  assert.deepEqual(charToKey('a'), { keyId: 'L21', layer: 0, shift: false });
  assert.deepEqual(charToKey('y'), { keyId: 'R10', layer: 0, shift: false });
  assert.deepEqual(charToKey('z'), { keyId: 'L32', layer: 0, shift: false });
  assert.deepEqual(charToKey('b'), { keyId: 'R30', layer: 0, shift: false });
});

test('uppercase letters need shift', () => {
  assert.deepEqual(charToKey('A'), { keyId: 'L21', layer: 0, shift: true });
  assert.deepEqual(charToKey('T'), { keyId: 'L15', layer: 0, shift: true });
  assert.deepEqual(charToKey('Z'), { keyId: 'L32', layer: 0, shift: true });
});

test('shifted punctuation resolves through shiftedL0', () => {
  assert.deepEqual(charToKey('<'), { keyId: 'L31', layer: 0, shift: true });
  assert.deepEqual(charToKey('>'), { keyId: 'R33', layer: 0, shift: true });
  assert.deepEqual(charToKey('?'), { keyId: 'R34', layer: 0, shift: true });
  assert.deepEqual(charToKey(':'), { keyId: 'R24', layer: 0, shift: true });
  assert.deepEqual(charToKey('_'), { keyId: 'R05', layer: 0, shift: true });
});

test('NAV layer characters resolve to layer 1', () => {
  assert.deepEqual(charToKey('\u2190'), { keyId: 'R20', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u2193'), { keyId: 'R21', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u2191'), { keyId: 'R22', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u2192'), { keyId: 'R23', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u21e4'), { keyId: 'R30', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u21e5'), { keyId: 'R31', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u21d1'), { keyId: 'R32', layer: 1, shift: false });
  assert.deepEqual(charToKey('\u21d3'), { keyId: 'R33', layer: 1, shift: false });
});

test('char map is unique; NAV held by comma; single shift key', () => {
  assert.equal(assertUniqueCharMap(), true);
  assert.equal(LAYER_HOLD[1], 'L31');
  assert.deepEqual(SHIFT_KEYS, ['L20']);
  assert.equal(SHIFT_KEY, 'L20');
});

test('shiftKeysFor picks the (only) shift for any target', () => {
  assert.deepEqual(shiftKeysFor({ keyId: 'R20', shift: true }), ['L20']);
  assert.deepEqual(shiftKeysFor({ keyId: 'L32', shift: true }), ['L20']);
  assert.deepEqual(shiftKeysFor({ keyId: 'R20', shift: false }), []);
});

test('KEYS count matches the keymap (51 rendered keys incl. named ones)', () => {
  assert.equal(KEYS.length, 51);
});

