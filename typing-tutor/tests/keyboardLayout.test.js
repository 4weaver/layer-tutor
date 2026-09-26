import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  charToKey, KEYS, LAYER_HOLD, SHIFT_KEY, SHIFT_KEYS,
  assertUniqueCharMap, shiftKeysFor,
} from '../js/keyboardLayout.js';

test('base-layer letters map to layer 0 without shift', () => {
  assert.deepEqual(charToKey('a'), { keyId: 'L21', layer: 0, shift: false });
  assert.deepEqual(charToKey('y'), { keyId: 'R10', layer: 0, shift: false });
  assert.deepEqual(charToKey('b'), { keyId: 'R30', layer: 0, shift: false });
});

test('uppercase letters need shift', () => {
  assert.deepEqual(charToKey('A'), { keyId: 'L21', layer: 0, shift: true });
  assert.deepEqual(charToKey('T'), { keyId: 'L15', layer: 0, shift: true });
});

test('digits live on base number row (layer 0)', () => {
  assert.deepEqual(charToKey('1'), { keyId: 'L01', layer: 0, shift: false });
  assert.deepEqual(charToKey('5'), { keyId: 'L05', layer: 0, shift: false });
  assert.deepEqual(charToKey('6'), { keyId: 'R00', layer: 0, shift: false });
  assert.deepEqual(charToKey('0'), { keyId: 'R04', layer: 0, shift: false });
});

test('arrows live on Nav layer (Space hold) hjkl keys', () => {
  assert.deepEqual(charToKey('←'), { keyId: 'R20', layer: 1, shift: false });
  assert.deepEqual(charToKey('↓'), { keyId: 'R21', layer: 1, shift: false });
  assert.deepEqual(charToKey('↑'), { keyId: 'R22', layer: 1, shift: false });
  assert.deepEqual(charToKey('→'), { keyId: 'R23', layer: 1, shift: false });
});

test('Sym layer (Enter hold) maps bang/percent/caret/tilde', () => {
  assert.deepEqual(charToKey('!'), { keyId: 'L34', layer: 2, shift: false });
  assert.deepEqual(charToKey('%'), { keyId: 'L23', layer: 2, shift: false });
  assert.deepEqual(charToKey('^'), { keyId: 'L22', layer: 2, shift: false });
  assert.deepEqual(charToKey('~'), { keyId: 'L31', layer: 2, shift: false });
});

test('Nav brackets and base/Sym punctuation', () => {
  assert.deepEqual(charToKey('-'), { keyId: 'R05', layer: 0, shift: false });
  assert.deepEqual(charToKey('['), { keyId: 'R31', layer: 1, shift: false });
  assert.deepEqual(charToKey('`'), { keyId: 'L00', layer: 0, shift: false });
  assert.deepEqual(charToKey('{'), { keyId: 'R11', layer: 1, shift: false });
  assert.deepEqual(charToKey(')'), { keyId: 'R14', layer: 1, shift: false });
  // = and \\ live on Num (Backspace hold) — not in tutor L1/L2 slots
  assert.equal(charToKey('='), null);
  assert.equal(charToKey('\\'), null);
});

test('layer-0 punctuation, plain and shifted', () => {
  assert.deepEqual(charToKey(';'), { keyId: 'R24', layer: 0, shift: false });
  assert.deepEqual(charToKey(':'), { keyId: 'R24', layer: 0, shift: true });
  assert.deepEqual(charToKey("'"), { keyId: 'R15', layer: 0, shift: false });
  // " is Enter-hold Sym on A, not shift of quote
  assert.deepEqual(charToKey('"'), { keyId: 'L21', layer: 2, shift: false });
  assert.deepEqual(charToKey('?'), { keyId: 'R34', layer: 0, shift: true });
});

test('space maps to Space/Nav thumb (tap Space, hold Nav)', () => {
  assert.deepEqual(charToKey(' '), { keyId: 'L41', layer: 0, shift: false });
  assert.equal(LAYER_HOLD[1], 'L41');
  assert.equal(LAYER_HOLD[2], 'R40');
});

test('unmappable characters return null', () => {
  assert.equal(charToKey('€'), null);
  assert.equal(charToKey('\t'), null);
});

test('layer hold keys and shift keys exist in KEYS', () => {
  for (const id of [...Object.values(LAYER_HOLD), ...SHIFT_KEYS, SHIFT_KEY]) {
    assert.ok(KEYS.some((k) => k.id === id), `missing key ${id}`);
  }
});

test('KEYS covers both halves of the Eyelash matrix', () => {
  assert.equal(KEYS.length, 52);
  assert.ok(KEYS.filter((k) => k.half === 'L').length >= 24);
  assert.ok(KEYS.filter((k) => k.half === 'R').length >= 24);
});

test('CHAR_MAP has no single-char legend conflicts', () => {
  assert.equal(assertUniqueCharMap(), true);
});

test('shiftKeysFor returns the dedicated left Shift (only outer Shift on BASE)', () => {
  assert.deepEqual(shiftKeysFor(charToKey('A')), ['L20']);
  // No right-half Shift key on BASE — falls back to the available Shift
  assert.deepEqual(shiftKeysFor(charToKey('Y')), ['L20']);
  assert.deepEqual(shiftKeysFor(charToKey('a')), []);
});
