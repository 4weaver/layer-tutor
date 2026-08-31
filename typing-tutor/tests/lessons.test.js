import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES, TRACK_META, buildRound, practiceRoundSize, PRACTICE_ROUND_MULT,
  buildWeakKeyRound, contextualTip, coachFromMistakes, todaysFocus,
  summarizeRunMetrics,
} from '../js/lessons.js';
import { charToKey, PRIMARY_BOARD } from '../js/keyboardLayout.js';

test('curriculum: 8 stages, base then nav, progressive order', () => {
  const ids = STAGES.map((s) => s.id);
  assert.equal(STAGES.length, 8);
  assert.deepEqual(ids.slice(0, 5), ['home-row', 'bottom-left', 'bottom-right', 'punctuation-shift', 'sentences']);
  assert.deepEqual(ids.slice(5), ['nav-arrows', 'nav-paging', 'hold-drill']);
});

test('track grouping preserves progressive stage order', () => {
  const orders = STAGES.map((stage) => TRACK_META[stage.track].order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test('every stage item uses only mappable characters', () => {
  for (const stage of STAGES) {
    for (const item of stage.pool) {
      for (const ch of item) {
        assert.ok(charToKey(ch), `stage ${stage.id}: no key mapping for ${JSON.stringify(ch)} in ${JSON.stringify(item)}`);
      }
    }
  }
});

test('every stage has a pool >= 20, coach tip, and positive roundSize', () => {
  for (const stage of STAGES) {
    assert.ok(stage.pool.length >= 20, `${stage.id} pool too small: ${stage.pool.length}`);
    assert.ok(stage.roundSize > 0, stage.id);
    assert.ok(stage.name && stage.layerHint && stage.coachTip, stage.id);
  }
});

test('buildRound and practiceRoundSize', () => {
  const stage = STAGES[0];
  assert.equal(buildRound(stage, () => 0).length, stage.roundSize);
  assert.ok(practiceRoundSize(stage) >= stage.roundSize * PRACTICE_ROUND_MULT);
});

test('layer usage per stage matches curriculum rules', () => {
  const expected = {
    'home-row': [0], 'bottom-left': [0], 'bottom-right': [0],
    'punctuation-shift': [0], sentences: [0],
    'nav-arrows': [1], 'nav-paging': [1], 'hold-drill': [0, 1],
  };
  for (const stage of STAGES) {
    const layers = new Set();
    for (const item of stage.pool) {
      for (const ch of item) layers.add(charToKey(ch).layer);
    }
    assert.deepEqual([...layers].sort((a, b) => a - b), expected[stage.id], stage.id);
  }
});

test('letter drills interleave home-row anchors (typing.com rule — never row-by-row)', () => {
  const home = new Set(['a', 's', 'd', 'f', 'h', 'j', 'k', 'l']);
  for (const id of ['bottom-left', 'bottom-right', 'punctuation-shift']) {
    const stage = STAGES.find((s) => s.id === id);
    for (const item of stage.pool) {
      const hasLetter = [...item].some((ch) => /[a-z]/i.test(ch));
      if (item.length < 2 || !hasLetter) continue; // intro singles & punctuation-only pairs exempt
      assert.ok(
        [...item].some((ch) => home.has(ch)),
        `${id}: ${JSON.stringify(item)} has no home-row anchor — hands would leave the bumps`,
      );
    }
  }
});

test('nav stages are held by the comma key on the board', () => {
  for (const ch of ['\u2190', '\u21e4']) {
    const m = charToKey(ch);
    assert.ok(m.layer === 1);
    assert.equal(PRIMARY_BOARD.LAYER_HOLD[m.layer], 'L31');
  }
});

test('buildWeakKeyRound prefers heatmap chars and stays mappable', () => {
  const items = buildWeakKeyRound({ a: 9, b: 4, '1': 2 }, charToKey, 12, () => 0);
  assert.equal(items.length, 12);
  for (const item of items) {
    for (const ch of item) assert.ok(charToKey(ch), ch);
  }
});

test('run analysis reports slow keys and layer transitions', () => {
  const analysis = summarizeRunMetrics({
    keyMetrics: {
      a: { attempts: 1, errors: 0, samples: 1, totalLatencyMs: 200 },
      '\u2190': { attempts: 1, errors: 0, samples: 1, totalLatencyMs: 600 },
    },
    events: [
      { ch: 'a', previousCh: null, latencyMs: 200 },
      { ch: '\u2190', previousCh: 'a', latencyMs: 600, errors: 1 },
      { ch: 'a', previousCh: '\u2190', latencyMs: 300 },
    ],
  }, charToKey);
  assert.equal(analysis.slowest[0].ch, '\u2190');
  assert.equal(analysis.transitionMetrics['enter-layer-1'].count, 1);
  assert.equal(analysis.transitions.find((row) => row.kind === 'enter-layer-1').accuracy, 50);
  assert.equal(analysis.transitionMetrics['exit-layer-1'].count, 1);
});

test('contextualTip mentions the comma hold for layer chars', () => {
  assert.match(contextualTip('\u2190', charToKey, 'x', PRIMARY_BOARD), /,/);
  assert.match(contextualTip('\u21e4', charToKey, 'x', PRIMARY_BOARD), /,/);
  assert.match(contextualTip('A', charToKey, 'x', PRIMARY_BOARD), /Shift/i);
  assert.match(contextualTip(' ', charToKey, 'x', PRIMARY_BOARD), /Space/i);
});

test('coachFromMistakes returns actionable line', () => {
  assert.match(coachFromMistakes({ '\u21e4': 3 }, charToKey), /layer 1|NAV/i);
  assert.match(coachFromMistakes({}, charToKey), /Clean/i);
});

test('todaysFocus points at unlock work', () => {
  const stages = STAGES.slice(0, 3);
  const progress = {
    stages: {
      [stages[0].id]: { unlocked: true, fluent: true, timesPlayed: 1, bestWpm: 30, bestAccuracy: 95 },
      [stages[1].id]: { unlocked: false, fluent: false, timesPlayed: 0, bestWpm: 0, bestAccuracy: 0 },
      [stages[2].id]: { unlocked: false, fluent: false, timesPlayed: 0, bestWpm: 0, bestAccuracy: 0 },
    },
    heatmap: {},
  };
  const f = todaysFocus(progress, stages);
  assert.equal(f.kind, 'unlock');
});

