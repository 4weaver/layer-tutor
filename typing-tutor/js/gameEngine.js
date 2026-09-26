// Pure typing state machine. No DOM, no timers — callers pass timestamps in.
//
// WPM timing starts on the first *correct* keystroke so early fumbles do not
// zero out the clock before the learner has begun the line. Errors before
// that still count toward accuracy and the mistake map.
//
// chordMode: each item is a chord token string, or a line is an array of
// chord tokens. Cursor indexes tokens (not characters); handleChord advances
// one token per successful combo match.

export function createGame(items, now = null, { lineGate = false, chordMode = false } = {}) {
  return {
    items,
    itemIndex: 0,
    cursor: 0,
    correct: 0,
    errors: 0,
    startTime: null,
    endTime: null,
    mistakes: {},
    keyMetrics: {},
    events: [],
    targetStartedAt: Number.isFinite(now) ? now : null,
    previousCorrectChar: null,
    currentTargetErrors: 0,
    done: false,
    // lineGate: when true each item is a LINE; finishing it does NOT auto-advance.
    // The caller must call requestAdvance()/advance() with an explicit Enter/key.
    lineGate,
    lineArmed: false, // last char of a line reached -> awaiting explicit advance
    chordMode: !!chordMode,
  };
}

export function currentItem(game) {
  return game.done ? null : game.items[game.itemIndex];
}

function itemUnitLength(game, item) {
  if (game.chordMode) {
    if (Array.isArray(item)) return item.length;
    return item == null ? 0 : 1;
  }
  return item?.length ?? 0;
}

/**
 * Current target character, if we are mid-line. When a line is completed and
 * armed (awaiting Enter), there is no char to type -> null.
 * In chordMode this returns the whole chord token string.
 */
export function currentChar(game) {
  if (game.lineArmed) return null;
  const item = currentItem(game);
  if (!item) return null;
  if (game.chordMode) {
    if (Array.isArray(item)) return item[game.cursor] ?? null;
    return game.cursor === 0 ? item : null;
  }
  return item[game.cursor];
}

/** Alias used by chord UI paths. */
export function currentChord(game) {
  if (!game.chordMode) return null;
  return currentChar(game);
}

/**
 * Whether the current line has been fully typed and awaits an explicit advance.
 */
export function isLineArmed(game) {
  return !game.done && !!game.lineGate && game.lineArmed;
}

/**
 * Advance past a completed (armed) line. Returns 'next' (entered/advanced) or
 * 'done' when the whole round concluded. Only valid when isLineArmed().
 */
export function advanceLine(game) {
  if (game.done || !game.lineArmed) return null;
  game.lineArmed = false;
  game.itemIndex += 1;
  game.cursor = 0;
  if (game.itemIndex >= game.items.length) {
    game.done = true;
    return 'done';
  }
  // a new line begins: set the first target clock only on a keystroke as usual
  return 'next';
}

/**
 * While a finished line awaits Enter, an unexpected (non-Enter) key is counted as
 * an error on a sentinel '<Enter>' token so the slip is not silently forgiven.
 * Returns true when recorded — caller plays its own visual/sound cue.
 */
export function countArmedMistake(game) {
  if (game.done || !game.lineArmed) return false;
  const key = '<Enter>';
  const metric = game.keyMetrics[key] ?? { attempts: 0, correct: 0, errors: 0, totalLatencyMs: 0, samples: 0 };
  metric.attempts += 1;
  metric.errors += 1;
  game.keyMetrics[key] = metric;
  game.errors += 1;
  game.mistakes[key] = (game.mistakes[key] ?? 0) + 1;
  return true;
}

function recordCorrect(game, target, now) {
  if (game.startTime === null) game.startTime = now;
  game.correct += 1;
  const metric = game.keyMetrics[target] ?? {
    attempts: 0, correct: 0, errors: 0, totalLatencyMs: 0, samples: 0,
  };
  metric.correct += 1;
  const latencyMs = game.targetStartedAt == null
    ? 0
    : Math.max(0, now - game.targetStartedAt);
  metric.totalLatencyMs += latencyMs;
  metric.samples += 1;
  game.keyMetrics[target] = metric;
  game.events.push({
    ch: target,
    previousCh: game.previousCorrectChar,
    latencyMs,
    errors: game.currentTargetErrors,
  });
  game.previousCorrectChar = target;
  game.currentTargetErrors = 0;
}

function advanceAfterCorrect(game, now) {
  game.cursor += 1;
  const item = game.items[game.itemIndex];
  const atEndOfItem = game.cursor >= itemUnitLength(game, item);
  if (atEndOfItem && game.lineGate && game.itemIndex < game.items.length - 1) {
    game.lineArmed = true;
    game.targetStartedAt = now;
    return 'line-done';
  }
  if (atEndOfItem && game.lineGate) {
    game.lineArmed = true;
    game.targetStartedAt = now;
    return 'line-complete-last';
  }
  if (atEndOfItem) {
    game.itemIndex += 1;
    game.cursor = 0;
    if (game.itemIndex >= game.items.length) {
      game.done = true;
      game.endTime = now;
      return 'done';
    }
  }
  game.targetStartedAt = now;
  return 'correct';
}

export function handleKey(game, ch, now) {
  if (game.done) return 'ignored';
  if (game.lineArmed) return 'awaiting-advance'; // must call advanceLine() first
  if (game.chordMode) return 'ignored'; // use handleChord
  const target = currentChar(game);
  const metric = game.keyMetrics[target] ?? {
    attempts: 0, correct: 0, errors: 0, totalLatencyMs: 0, samples: 0,
  };
  metric.attempts += 1;
  game.keyMetrics[target] = metric;
  if (ch === target) {
    recordCorrect(game, target, now);
    return advanceAfterCorrect(game, now);
  }
  // Wrong key: count error even before the WPM clock starts.
  game.errors += 1;
  metric.errors += 1;
  game.currentTargetErrors += 1;
  game.mistakes[target] = (game.mistakes[target] ?? 0) + 1;
  game.lastWrong = ch;
  return 'error';
}

/**
 * Chord-mode input: `ok` true when the KeyboardEvent matched the current chord.
 * Metrics are keyed by the chord token / label string.
 */
export function handleChord(game, ok, now) {
  if (game.done) return 'ignored';
  if (!game.chordMode) return 'ignored';
  if (game.lineArmed) return 'awaiting-advance';
  const target = currentChar(game);
  if (target == null) return 'ignored';
  const metric = game.keyMetrics[target] ?? {
    attempts: 0, correct: 0, errors: 0, totalLatencyMs: 0, samples: 0,
  };
  metric.attempts += 1;
  game.keyMetrics[target] = metric;
  if (ok) {
    recordCorrect(game, target, now);
    return advanceAfterCorrect(game, now);
  }
  game.errors += 1;
  metric.errors += 1;
  game.currentTargetErrors += 1;
  game.mistakes[target] = (game.mistakes[target] ?? 0) + 1;
  game.lastWrong = null;
  return 'error';
}

/** Total characters (or chord tokens) remaining including current item (for progress bar). */
export function progressCounts(game) {
  let total = 0;
  let done = 0;
  for (let i = 0; i < game.items.length; i++) {
    const len = itemUnitLength(game, game.items[i]);
    total += len;
    if (i < game.itemIndex) done += len;
    else if (i === game.itemIndex) done += game.cursor;
  }
  return { done, total, frac: total > 0 ? done / total : 0 };
}

export function stats(game, now = Date.now()) {
  const end = game.endTime ?? now;
  const elapsedMin = game.startTime === null ? 0 : (end - game.startTime) / 60000;
  const wpm = elapsedMin > 0 ? game.correct / 5 / elapsedMin : 0;
  const total = game.correct + game.errors;
  const accuracy = total > 0 ? (game.correct / total) * 100 : 100;
  return { wpm: Math.round(wpm), accuracy: Math.round(accuracy * 10) / 10 };
}
