import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES, TRACK_META, buildRound, practiceRoundSize, PRACTICE_ROUND_MULT,
  buildWeakKeyRound, contextualTip, coachFromMistakes, todaysFocus,
  summarizeRunMetrics, buildIntroDrill, INTRO_HOME_ORDER, buildKeyDrills, KEY_ROLLS,
  stagesForBoard, unlockChainForBoard,
} from '../js/lessons.js';
import { charToKey } from '../js/keyboardLayout.js';

test('curriculum includes bigrams, hold-drill, pulse-drill in order', () => {
  const ids = STAGES.map((s) => s.id);
  assert.ok(ids.includes('bigrams'));
  assert.ok(ids.indexOf('bigrams') > ids.indexOf('home-row'));
  assert.ok(ids.includes('hold-drill'));
  assert.ok(ids.includes('pulse-drill'));
  assert.ok(ids.includes('home-row-mods'));
  assert.ok(ids.includes('hrm-tap'));
  assert.ok(ids.includes('nav-brackets'));
  // Menu/track order may keep HRM after all-letters; unlock gating is via unlockAfter, not array index.
  assert.ok(ids.indexOf('nav-brackets') > ids.indexOf('navigation'));
  assert.ok(ids.indexOf('hold-drill') > ids.indexOf('nav-brackets'));
  assert.equal(STAGES.length, 18);
});

test('HRM stages use parallel unlockAfter, excluded from linear unlock chain', () => {
  const hrm = STAGES.find((s) => s.id === 'home-row-mods');
  const tap = STAGES.find((s) => s.id === 'hrm-tap');
  assert.equal(hrm.unlockAfter, 'home-row');
  assert.equal(tap.unlockAfter, 'home-row-mods');

  const chain = unlockChainForBoard('eyelash-sofle').map((s) => s.id);
  assert.equal(chain.includes('home-row-mods'), false);
  assert.equal(chain.includes('hrm-tap'), false);
  assert.ok(chain.includes('home-row'));
  assert.ok(chain.includes('bottom-row'));
  assert.ok(chain.includes('left-hand'));
  assert.ok(chain.includes('all-letters'));
  assert.equal(chain[chain.indexOf('bottom-row') + 1], 'left-hand');

  // Menu still lists HRM via stagesForBoard
  const menu = stagesForBoard('eyelash-sofle').map((s) => s.id);
  assert.ok(menu.includes('home-row-mods'));
  assert.ok(menu.includes('hrm-tap'));
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

test('every stage has a large non-empty pool, coach tip, and positive roundSize', () => {
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
  // Eyelash Sofle: digits on BASE; Space→Nav (L1); Enter→Sym (L2).
  // Nav also owns brackets, so symbol/punct pools may touch layer 1.
  const expected = {
    'home-row': [0], bigrams: [0], 'top-row': [0], 'bottom-row': [0],
    'left-hand': [0], 'right-hand': [0], 'all-letters': [0],
    numbers: [0], navigation: [1], 'nav-brackets': [1], 'hold-drill': [1],
    'home-row-mods': [0], 'hrm-tap': [0],
    'symbol-layer': [0, 1, 2], punctuation: [0, 1, 2],
    'pulse-drill': [0, 1, 2], 'layer-transitions': [0, 1, 2], mixed: [0, 1, 2],
  };
  for (const stage of STAGES) {
    const layers = new Set();
    for (const item of stage.pool) {
      for (const ch of item) layers.add(charToKey(ch).layer);
    }
    assert.deepEqual([...layers].sort((a, b) => a - b), expected[stage.id], stage.id);
  }
});

test('buildWeakKeyRound prefers heatmap chars and stays mappable', () => {
  const items = buildWeakKeyRound({ a: 9, b: 4, '1': 2 }, charToKey, 12, () => 0);
  assert.equal(items.length, 12);
  for (const item of items) {
    for (const ch of item) assert.ok(charToKey(ch), ch);
  }
});

test('weak-key rounds ignore unmappable imported metrics and always terminate', () => {
  const items = buildWeakKeyRound(
    { '💩': 99 },
    charToKey,
    12,
    () => 0,
    { '💩': { attempts: 10, errors: 10, samples: 0, totalLatencyMs: 0 } },
  );
  assert.equal(items.length, 12);
  assert.ok(items.every((item) => [...item].every((ch) => charToKey(ch))));
});

test('run analysis reports slow keys and layer transitions', () => {
  const analysis = summarizeRunMetrics({
    keyMetrics: {
      a: { attempts: 1, errors: 0, samples: 1, totalLatencyMs: 200 },
      '←': { attempts: 1, errors: 0, samples: 1, totalLatencyMs: 600 },
    },
    events: [
      { ch: 'a', previousCh: null, latencyMs: 200 },
      { ch: '←', previousCh: 'a', latencyMs: 600, errors: 1 },
      { ch: 'a', previousCh: '←', latencyMs: 300 },
    ],
  }, charToKey);
  assert.equal(analysis.slowest[0].ch, '←');
  assert.equal(analysis.transitionMetrics['enter-layer-1'].count, 1);
  assert.equal(analysis.transitions.find((row) => row.kind === 'enter-layer-1').accuracy, 50);
  assert.equal(analysis.transitionMetrics['exit-layer-1'].count, 1);
});

test('editorial filter removes blocked and broken generated content', () => {
  const allItems = STAGES.flatMap((stage) => stage.pool);
  assert.equal(allItems.some((item) => /\b(?:fag|fags|nazi|lsd)\b/i.test(item)), false);
  assert.equal(STAGES.find((stage) => stage.id === 'all-letters').pool
    .some((item) => /\b(?:can|will)\s+\w+s\b|^Please\s+\w+s\b|^Did\s+.+\s+\w+s\b/i.test(item)), false);
});

test('contextualTip mentions hold for layer chars', () => {
  assert.match(contextualTip('←', charToKey, 'x'), /Space|Nav/i);
  assert.match(contextualTip('!', charToKey, 'x'), /Enter|Sym/i);
  assert.match(contextualTip('A', charToKey, 'x'), /Shift/i);
  assert.match(contextualTip(' ', charToKey, 'x'), /Space/i);
});

test('coachFromMistakes returns actionable line', () => {
  assert.match(coachFromMistakes({ '!': 3 }, charToKey), /layer-2|Sym|Symbol/i);
  assert.match(coachFromMistakes({ '←': 3 }, charToKey), /layer-1|Nav|Hold/i);
  assert.match(coachFromMistakes({}, charToKey), /Clean/i);
});

test('todaysFocus points at unlock or fluent work', () => {
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

test('todaysFocus can suggest HRM after home-row while later linear stages stay locked', () => {
  const stages = [
    STAGES.find((s) => s.id === 'home-row'),
    STAGES.find((s) => s.id === 'bigrams'),
    STAGES.find((s) => s.id === 'home-row-mods'),
  ];
  const progress = {
    stages: {
      'home-row': { unlocked: true, fluent: true, timesPlayed: 2, bestWpm: 30, bestAccuracy: 95 },
      bigrams: { unlocked: true, fluent: false, timesPlayed: 0, bestWpm: 0, bestAccuracy: 0 },
      'home-row-mods': { unlocked: true, fluent: false, timesPlayed: 0, bestWpm: 0, bestAccuracy: 0 },
    },
    heatmap: {},
  };
  const f = todaysFocus(progress, stages);
  assert.equal(f.kind, 'parallel');
  assert.equal(f.stageId, 'home-row-mods');
});

// ---- Intro key-drill generator ----

test('buildIntroDrill wraps a target in every home anchor, space-separated', () => {
  const line = buildIntroDrill('b');
  const words = line.split(' ');
  assert.equal(words.length, INTRO_HOME_ORDER.length);
  assert.deepEqual(words.map((w) => w[0]), INTRO_HOME_ORDER);
  assert.deepEqual(words.map((w) => w[2]), INTRO_HOME_ORDER);
  assert.ok(words.every((w) => w[1] === 'b'));
  assert.equal(line, 'aba sbs dbd fbf gbg hbh jbj kbk lbl');
});

test('intro sandwiches are deterministic and anchor-to-target order matches home', () => {
  const d = buildIntroDrill('d', ['f', 'a']);
  assert.equal(d, 'fdf ada'); // respects a custom tiny anchor order for pairing tests
});

test('canonical first lower-row target v matches mappable anchors', () => {
  for (const ch of ['v', 'b', '.']) {
    for (const w of buildIntroDrill(ch).split(' ')) {
      for (const c of w) assert.ok(charToKey(c), `${JSON.stringify(c)} of ${ch} drill unmapped`);
    }
  }
});

// ---- Phase-II rolling/key drills ----

test('buildKeyDrills returns sandwich first, then curated rolls', () => {
  const lines = buildKeyDrills('b');
  assert.equal(lines[0], 'aba sbs dbd fbf gbg hbh jbj kbk lbl');
  assert.equal(lines[1], 'jbk lbg');
  assert.equal(buildKeyDrills('q').length, 1); // unmatched -> sandwich only
});

test('every curated roll word is fully mappable', () => {
  for (const [ch, roll] of Object.entries(KEY_ROLLS)) {
    for (const w of roll.split(' ')) {
      assert.ok(w.length >= 3, `roll word too short: ${JSON.stringify(w)}`);
      for (const c of w) assert.ok(charToKey(c), `${JSON.stringify(c)} in roll for ${ch} unmapped`);
    }
  }
});


test('eyelash-only HRM/Nav-brackets stages gate on board id', () => {
  const eye = stagesForBoard('eyelash-sofle').map((s) => s.id);
  const corne = stagesForBoard('corne-v4').map((s) => s.id);
  assert.ok(eye.includes('home-row-mods'));
  assert.ok(eye.includes('hrm-tap'));
  assert.ok(eye.includes('nav-brackets'));
  assert.equal(corne.includes('home-row-mods'), false);
  assert.equal(corne.includes('hrm-tap'), false);
  assert.equal(corne.includes('nav-brackets'), false);
  // Shared stages still present for Corne
  assert.ok(corne.includes('home-row'));
  assert.ok(corne.includes('navigation'));
  assert.ok(corne.includes('hold-drill'));
});

test('home-row-mods coach tip documents GASC pinky→index order', () => {
  const s = STAGES.find((x) => x.id === 'home-row-mods');
  assert.match(s.coachTip, /GASC/i);
  assert.match(s.coachTip, /GUI\/Alt\/Shift\/Ctrl/);
  assert.match(s.coachTip, /;\/L\/K\/J/);
});

test('nav stages hold Space (L41), not Lily58 comma', () => {
  for (const id of ['navigation', 'nav-brackets', 'hold-drill']) {
    const s = STAGES.find((x) => x.id === id);
    assert.match(s.layerHint + ' ' + s.coachTip, /Space/i);
    assert.equal(/comma/i.test(s.layerHint + ' ' + s.coachTip), false, id);
  }
});

test('nav-brackets pool is Nav-layer brackets only (no paging glyphs)', () => {
  const s = STAGES.find((x) => x.id === 'nav-brackets');
  const allowed = new Set('[]{}()');
  for (const item of s.pool) {
    for (const ch of item) {
      assert.ok(allowed.has(ch), `unexpected ${JSON.stringify(ch)} in ${item}`);
      assert.equal(charToKey(ch).layer, 1, ch);
      assert.ok(['R11','R12','R13','R14','R31','R32'].includes(charToKey(ch).keyId), ch);
    }
  }
});

test('hrm stages only use base-layer home/mod letters', () => {
  const keys = new Set('asdfghjkl; ');
  for (const id of ['home-row-mods', 'hrm-tap']) {
    const s = STAGES.find((x) => x.id === id);
    for (const item of s.pool) {
      for (const ch of item) {
        assert.ok(keys.has(ch), `${id}: bad char ${JSON.stringify(ch)} in ${JSON.stringify(item)}`);
        if (ch !== ' ') assert.equal(charToKey(ch).layer, 0, ch);
      }
    }
  }
});
