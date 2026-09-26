import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isChordToken, parseChord, eventMatchesChord, isBareModifierEvent,
  chordHighlightTarget, packChordLines,
} from '../js/chords.js';
import { getBoard } from '../js/boards/index.js';

function fakeEvent({ key, ctrl = false, alt = false, meta = false, shift = false }) {
  return { key, ctrlKey: ctrl, altKey: alt, metaKey: meta, shiftKey: shift };
}

test('isChordToken / parseChord basic mods', () => {
  assert.equal(isChordToken('a'), false);
  assert.equal(isChordToken('Ctrl+c'), true);
  const c = parseChord('Ctrl+c');
  assert.equal(c.key, 'c');
  assert.ok(c.mods.has('ctrl'));
  assert.equal(c.mods.size, 1);
  assert.equal(c.label, 'Ctrl+C');

  const multi = parseChord('Ctrl+Shift+z');
  assert.ok(multi.mods.has('ctrl') && multi.mods.has('shift'));
  assert.equal(multi.label, 'Ctrl+Shift+Z');

  assert.equal(parseChord('GUI+s').label, 'GUI+S');
  assert.equal(parseChord('Alt+f').label, 'Alt+F');
  assert.equal(parseChord('meta+v').label, 'GUI+V'); // alias
  assert.equal(parseChord('control+a').label, 'Ctrl+A');
});

test('parseChord rejects bad tokens', () => {
  assert.equal(isChordToken('Ctrl+'), false);
  assert.equal(isChordToken('+c'), false);
  assert.equal(isChordToken('Foo+c'), false);
  assert.throws(() => parseChord('Ctrl+enter'));
});

test('eventMatchesChord matches OS-style modifier combos', () => {
  const chord = parseChord('Ctrl+c');
  assert.equal(eventMatchesChord(fakeEvent({ key: 'c', ctrl: true }), chord), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'C', ctrl: true }), chord), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'c' }), chord), false);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'v', ctrl: true }), chord), false);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'c', ctrl: true, shift: true }), chord), false);

  const shiftA = parseChord('Shift+a');
  assert.equal(eventMatchesChord(fakeEvent({ key: 'A', shift: true }), shiftA), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'a', shift: true }), shiftA), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'a' }), shiftA), false);

  const gui = parseChord('GUI+s');
  assert.equal(eventMatchesChord(fakeEvent({ key: 's', meta: true }), gui), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 's', ctrl: true }), gui), false);

  const both = parseChord('Ctrl+Shift+c');
  assert.equal(eventMatchesChord(fakeEvent({ key: 'c', ctrl: true, shift: true }), both), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'c', ctrl: true }), both), false);
});

test('bare modifier keydowns do not match', () => {
  const chord = parseChord('Ctrl+c');
  assert.equal(isBareModifierEvent(fakeEvent({ key: 'Control', ctrl: true })), true);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'Control', ctrl: true }), chord), false);
  assert.equal(eventMatchesChord(fakeEvent({ key: 'Shift', shift: true }), parseChord('Shift+a')), false);
});

test('chordHighlightTarget prefers same-hand HRM key on eyelash', () => {
  const board = getBoard('eyelash-sofle');
  assert.deepEqual(board.homeRowMods.ctrl, ['L24', 'R21']);
  assert.deepEqual(board.homeRowMods.gui, ['L21', 'R24']);

  // C is left (L34) → left Ctrl F (L24)
  const ctrlC = chordHighlightTarget(board, parseChord('Ctrl+c'));
  assert.equal(ctrlC.keyId, 'L34');
  assert.deepEqual(ctrlC.modHolds, ['L24']);

  // Y is right (R10) → right Ctrl J (R21)
  const ctrlY = chordHighlightTarget(board, parseChord('Ctrl+y'));
  assert.equal(ctrlY.keyId, 'R10');
  assert.deepEqual(ctrlY.modHolds, ['R21']);

  // Shift+a → D (L23) + A tap
  const shiftA = chordHighlightTarget(board, parseChord('Shift+a'));
  assert.equal(shiftA.keyId, 'L21');
  assert.deepEqual(shiftA.modHolds, ['L23']);
  assert.equal(shiftA.shift, false); // HRM shift, not dedicated Shift keycap
});

test('packChordLines groups tokens', () => {
  assert.deepEqual(packChordLines(['Ctrl+c', 'Ctrl+v', 'Alt+f'], 2), [
    ['Ctrl+c', 'Ctrl+v'],
    ['Alt+f'],
  ]);
});

test('corne has empty homeRowMods', () => {
  const corne = getBoard('corne-v4');
  // Corne is not built via boardFromDeclaration with homeRowMods — may be undefined
  // unless createLayout boards add it. Either empty or undefined is fine for combo gating
  // (combo stages are eyelash-only via boardIds).
  const mods = corne.homeRowMods;
  assert.ok(!mods || !Object.keys(mods).length || !mods.ctrl?.length);
});
