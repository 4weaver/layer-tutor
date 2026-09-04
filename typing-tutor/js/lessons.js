// Progressive curriculum + round builders (weak keys, sandbox, custom lists).
// Fork: 8 stages tuned for the Lily58 (inogai/zmk-config) — high-repetition drills
// for the shifted bottom row (ZXCV/B/comma) and the hold-comma NAV layer.

import { POOLS } from './lessonPools.js';
import { EXTRA_POOLS } from './lessonPoolsExtra.js';
import { PASS_ACCURACY, FLUENT_WPM } from './storage.js';

export { PASS_ACCURACY, FLUENT_WPM };

export const PRACTICE_ROUND_MULT = 3;

/** Track labels for menu grouping */
export const TRACK_META = {
  base: { title: 'Base layer · new key positions', order: 0 },
  nav: { title: 'NAV layer · hold comma', order: 1 },
};

/**
 * @typedef {object} Stage
 * @property {string} id
 * @property {string} name
 * @property {string} layerHint
 * @property {string} coachTip
 * @property {number} roundSize
 * @property {string[]} pool
 * @property {'base'|'nav'} track
 */

/** @type {Stage[]} */
export const STAGES = [
  {
    id: 'home-row',
    name: 'Home Row',
    layerHint: 'Base layer · fingers rest here',
    coachTip: 'Park eight fingers on A S D F / H J K L. This row did not move — a warm-up baseline.',
    roundSize: 40,
    pool: POOLS['home-row'],
    track: 'base',
  },
  {
    id: 'bottom-left',
    name: 'Bottom Left · Z X C V',
    layerHint: 'Base layer · reach down, one column right',
    coachTip: 'Z X C V moved ONE column right — reach down with middle/index, then RETURN to the F/J bumps after every key. Never park your hand on the bottom row.',
    roundSize: 48,
    pool: POOLS['bottom-left'],
    track: 'base',
  },
  {
    id: 'bottom-right',
    name: 'Bottom Right · B N M . /',
    layerHint: 'Base layer · reach down, index-inner',
    coachTip: 'B N M . / sit straight under H J K L ;. Reach down from J/K/L, strike, and return to the bumps after every key — home row is your anchor.',
    roundSize: 48,
    pool: POOLS['bottom-right'],
    track: 'base',
  },
  {
    id: 'punctuation-shift',
    name: 'Punctuation & Shift',
    layerHint: 'Base layer · , . / ; - and shifted pairs',
    coachTip: 'Stay parked on home: reach for , . / ; - and come back after every key. Shift rides the left pinky — hold, strike, release.',
    roundSize: 48,
    pool: POOLS['punctuation-shift'],
    track: 'base',
  },
  {
    id: 'sentences',
    name: 'Full Sentences',
    layerHint: 'Base layer · everything together',
    coachTip: 'Both hands, all rows, capitals and punctuation. Trust the green target key — it shows the real position.',
    roundSize: 6,
    pool: POOLS.sentences,
    track: 'base',
  },
  {
    id: 'nav-arrows',
    name: 'NAV Arrows',
    layerHint: 'Hold comma (left ring) · arrows on HJKL',
    coachTip: 'Hold the comma key down (do not tap it), then H J K L on the right hand are ← ↓ ↑ →. Release after the arrow.',
    roundSize: 40,
    pool: POOLS['nav-arrows'],
    track: 'nav',
  },
  {
    id: 'nav-paging',
    name: 'NAV Paging',
    layerHint: 'Hold comma · HOME END PG_UP PG_DN',
    coachTip: 'Still holding comma: B N M . positions become HOME END PG_UP PG_DN. B is home — index finger.',
    roundSize: 40,
    pool: POOLS['nav-paging'],
    track: 'nav',
  },
  {
    id: 'hold-drill',
    name: 'Hold Drill · type + navigate',
    layerHint: 'Keep comma held across a whole token',
    coachTip: 'Hold comma for the ENTIRE item. The left hand keeps typing normally (it passes through) while the right hand works the nav keys — exactly how real editing feels.',
    roundSize: 24,
    pool: POOLS['hold-drill'],
    track: 'nav',
  },
];

export function buildRound(stage, rand = Math.random, count = stage.roundSize) {
  const source = stage.pool?.length ? stage.pool : ['a'];
  const pool = [...source];
  const items = [];
  const n = Math.max(1, count);
  while (items.length < n) {
    const i = Math.floor(rand() * pool.length);
    items.push(pool.splice(i, 1)[0]);
    if (pool.length === 0) pool.push(...source);
  }
  return items;
}

export function practiceRoundSize(stage) {
  return Math.max(stage.roundSize * PRACTICE_ROUND_MULT, stage.roundSize + 5);
}

/** Build items overweighting heatmap misses (and neighbors). */
export function buildWeakKeyRound(
  heatmap,
  charToKey,
  count = 24,
  rand = Math.random,
  keyMetrics = {},
) {
  const chars = new Set([...Object.keys(heatmap || {}), ...Object.keys(keyMetrics || {})]);
  const ranked = [...chars]
    .filter((ch) => charToKey(ch))
    .map((ch) => {
      const m = keyMetrics[ch] || {};
      const attempts = Math.max(0, Number(m.attempts) || 0);
      const errors = Math.max(0, Number(m.errors) || Number(heatmap?.[ch]) || 0);
      const samples = Math.max(0, Number(m.samples) || 0);
      const errorRate = attempts ? errors / attempts : Math.min(1, errors / 3);
      const avgLatency = samples ? (Number(m.totalLatencyMs) || 0) / samples : 0;
      const confidence = Math.min(1, Math.max(0.25, attempts / 8));
      const score = errorRate * 5 * confidence + Math.min(2, avgLatency / 1000);
      return [ch, score];
    })
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length) {
    return buildRound(
      { pool: [...'asdfghjkl', ...'qwertyuiop', ' thrice'], roundSize: count },
      rand,
      count,
    );
  }
  const top = ranked.slice(0, 12).map(([ch]) => ch);
  const items = [];
  let attempts = 0;
  const maxAttempts = Math.max(100, count * 50);
  while (items.length < count && attempts < maxAttempts) {
    attempts += 1;
    if (rand() < 0.7) {
      const a = top[Math.floor(rand() * top.length)];
      const b = top[Math.floor(rand() * top.length)];
      const len = 1 + Math.floor(rand() * 4);
      let s = '';
      for (let i = 0; i < len; i++) s += top[Math.floor(rand() * top.length)];
      if ([...s].every((ch) => charToKey(ch))) items.push(s);
      else if (charToKey(a)) items.push(a + (charToKey(b) ? b : ''));
    } else {
      const easy = 'asdfghjkl';
      const miss = top[Math.floor(rand() * top.length)];
      const e = easy[Math.floor(rand() * easy.length)];
      const s = rand() < 0.5 ? e + miss + e : miss + e + miss;
      if ([...s].every((ch) => charToKey(ch))) items.push(s);
    }
  }
  const fallback = [...'asdfghjklqwertyuiop'].filter((ch) => charToKey(ch));
  while (items.length < count && fallback.length) {
    items.push(fallback[items.length % fallback.length]);
  }
  return items;
}

function transitionKind(previous, current) {
  if (!previous || !current) return 'start';
  if (previous.layer === 0 && current.layer > 0) return 'enter-layer-' + current.layer;
  if (previous.layer > 0 && current.layer === 0) return 'exit-layer-' + previous.layer;
  if (previous.layer !== current.layer) return 'switch-layer';
  if (previous.keyId?.[0] !== current.keyId?.[0]) return 'switch-hand';
  return current.layer > 0 ? 'stay-layer-' + current.layer : 'same-hand-base';
}

/** Aggregate a completed run into durable metrics and concise coaching. */
export function summarizeRunMetrics(game, charToKey) {
  const transitionMetrics = {};
  for (const event of game?.events || []) {
    const kind = transitionKind(charToKey(event.previousCh), charToKey(event.ch));
    const metric = transitionMetrics[kind] || { count: 0, errors: 0, totalLatencyMs: 0 };
    metric.count += 1;
    metric.errors += Math.max(0, Number(event.errors) || 0);
    metric.totalLatencyMs += Math.max(0, Number(event.latencyMs) || 0);
    transitionMetrics[kind] = metric;
  }

  const keyRows = Object.entries(game?.keyMetrics || {}).map(([ch, m]) => ({
    ch,
    errorRate: m.attempts ? m.errors / m.attempts : 0,
    avgLatencyMs: m.samples ? m.totalLatencyMs / m.samples : 0,
    attempts: m.attempts,
  }));
  const sampled = keyRows.filter((r) => r.avgLatencyMs > 0);
  const avgLatencyMs = sampled.length
    ? Math.round(sampled.reduce((sum, r) => sum + r.avgLatencyMs, 0) / sampled.length)
    : 0;
  const slowest = [...sampled]
    .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs || b.errorRate - a.errorRate)
    .slice(0, 5);
  const transitionRows = Object.entries(transitionMetrics)
    .filter(([kind]) => kind !== 'start')
    .map(([kind, m]) => ({
      kind,
      count: m.count,
      accuracy: Math.round((m.count / Math.max(1, m.count + m.errors)) * 1000) / 10,
      avgLatencyMs: m.count ? Math.round(m.totalLatencyMs / m.count) : 0,
    }))
    .sort((a, b) => (
      ((100 - b.accuracy) * 20 + b.avgLatencyMs)
      - ((100 - a.accuracy) * 20 + a.avgLatencyMs)
    ));

  let transitionCoach = '';
  const slowTransition = transitionRows[0];
  if (slowTransition?.kind.startsWith('exit-layer')) {
    transitionCoach = 'Layer release is the toughest transition — release the comma as the nav key lands.';
  } else if (slowTransition?.kind.startsWith('enter-layer')) {
    transitionCoach = 'Layer entry is the toughest transition — lead with the comma hold, then strike the target.';
  } else if (slowTransition?.kind === 'switch-hand') {
    transitionCoach = 'Hand switches are costing the most time — keep both hands parked over home.';
  }

  return {
    keyMetrics: game?.keyMetrics || {},
    transitionMetrics,
    avgLatencyMs,
    slowest,
    transitions: transitionRows,
    transitionCoach,
  };
}

export function buildCustomRound(items, count = 20, rand = Math.random) {
  const pool = (items || []).filter((x) => typeof x === 'string' && x.length > 0);
  if (!pool.length) return ['type', 'your', 'list'];
  return buildRound({ pool, roundSize: count }, rand, count);
}

function holdKeyLabel(board, layer) {
  const id = board?.LAYER_HOLD?.[layer];
  const key = board?.KEYS?.find((k) => k.id === id);
  return key ? key.legends[0] : null;
}

/** Contextual one-liner for the character about to be typed. */
export function contextualTip(ch, charToKey, stageCoachTip, board) {
  if (ch == null) return stageCoachTip || '';
  const m = charToKey(ch);
  if (!m) return stageCoachTip || '';
  const targetKey = board?.KEYS?.find((k) => k.id === m.keyId);
  const keyName = targetKey?.legends?.[0];
  if (m.layer > 0) {
    const hold = holdKeyLabel(board, m.layer);
    if (hold) return 'Hold ' + hold + ', then ' + (keyName ?? 'the green key') + ' for "' + ch + '"';
    return 'Hold the layer key, then the green key for "' + ch + '"';
  }
  if (m.shift) {
    return 'Hold Shift, then the green key for "' + ch + '"';
  }
  if (ch === ' ') return 'Thumb Space (left inner tall key)';
  return stageCoachTip || 'Eyes on the prompt — trust the green key';
}

/** One-line coaching from a run's mistakes + heatmap. */
export function coachFromMistakes(mistakes, charToKey) {
  const entries = Object.entries(mistakes || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return 'Clean run. Nudge WPM next — accuracy is locked in.';
  const [ch, n] = entries[0];
  const m = charToKey?.(ch);
  if (m?.layer > 0) return 'Most misses on layer ' + m.layer + ' ("' + ch + '" x' + n + ') — try NAV Arrows or Hold Drill.';
  if (m?.shift) return 'Shift + "' + ch + '" is sticky (x' + n + '). Slow the shift press; dont bounce.';
  if (ch === ' ') return 'Space timing is off (x' + n + '). Plant the left thumb; dont stab.';
  return 'Most misses on "' + ch + '" (x' + n + '). Use Practice weak keys to overweight it.';
}

/** Today's focus suggestion from progress. */
export function todaysFocus(progress, stages = STAGES) {
  const unlocked = stages.filter((s) => progress.stages[s.id]?.unlocked);
  const nextLocked = stages.find((s) => !progress.stages[s.id]?.unlocked);
  const weak = Object.entries(progress.keyMetrics || {})
    .filter(([, m]) => m?.attempts > 0)
    .map(([ch, m]) => [ch, (m.errors / m.attempts) + ((m.samples ? m.totalLatencyMs / m.samples : 0) / 5000)])
    .sort((a, b) => b[1] - a[1])[0]
    || Object.entries(progress.heatmap || {}).sort((a, b) => b[1] - a[1])[0];
  if (nextLocked) {
    const prev = stages[stages.indexOf(nextLocked) - 1];
    return {
      kind: 'unlock',
      title: 'Clear ' + (prev?.name || 'previous') + ' to unlock ' + nextLocked.name + '.',
      stageId: prev?.id ?? null,
    };
  }
  const unfluent = unlocked.find((s) => !progress.stages[s.id]?.fluent);
  if (unfluent) {
    return {
      kind: 'fluent',
      title: 'Push ' + unfluent.name + ' to fluent (≥' + FLUENT_WPM + ' wpm @ ≥' + PASS_ACCURACY + '%)',
      stageId: unfluent.id,
    };
  }
  if (weak) {
    return {
      kind: 'weak',
      title: 'Weakest key: ' + JSON.stringify(weak[0]) + ' — train its accuracy and response time',
      stageId: null,
    };
  }
  return {
    kind: 'practice',
    title: 'Everything cleared — practice Hold Drill or free-type in the sandbox',
    stageId: 'hold-drill',
  };
}

