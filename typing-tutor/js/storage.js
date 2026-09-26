// localStorage only. Injectable getItem/setItem for Node tests.
//
// Schema v4 (multi-board):
// {
//   version: 4,
//   activeBoardId: 'corne-v4',
//   onboardingDone: false,
//   boards: {
//     'corne-v4': {
//       stages: { id: { unlocked, bestWpm, bestAccuracy, timesPlayed, fluent,
//                        recentRuns: [{wpm,accuracy,at}], note, wpmGoal } },
//       heatmap: { ch: n },
//       keyMetrics: { ch: { attempts, correct, errors, totalLatencyMs, samples } },
//       transitionMetrics: { kind: { count, errors, totalLatencyMs } },
//       sessionRuns: [{ wpm, accuracy, avgLatencyMs, at }],
//       streak: { lastDate: 'YYYY-MM-DD', count: 0 },
//       customLists: [{ id, name, items: string[] }],
//       settings: { focusMode, showHomeGhost, boardCollapsed, reducedBoardAuto, soundEnabled }
//     }
//   }
// }

export const STORE_KEY = 'qmk-typing-tutor-v1';
const LEGACY_SOUND_KEY = 'qmk-typing-tutor-sound';
export const SCHEMA_VERSION = 4;
export const PASS_ACCURACY = 90;
export const FLUENT_WPM = 25;
export const RECENT_RUNS_MAX = 5;

const RENAMES = { 'shifted-symbols': 'symbol-layer' };

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function emptyStage(unlocked) {
  return {
    unlocked: !!unlocked,
    bestWpm: 0,
    bestAccuracy: 0,
    timesPlayed: 0,
    fluent: false,
    recentRuns: [],
    note: '',
    wpmGoal: 0,
  };
}

function defaultSettings() {
  return {
    focusMode: true,
    showHomeGhost: true,
    boardCollapsed: false,
    reducedBoardAuto: true,
    soundEnabled: true,
  };
}

function emptyBoardProgress() {
  return {
    stages: {},
    heatmap: {},
    keyMetrics: {},
    transitionMetrics: {},
    sessionRuns: [],
    streak: { lastDate: '', count: 0 },
    customLists: [],
    settings: defaultSettings(),
  };
}

function emptyRoot(defaultBoardId) {
  return {
    version: SCHEMA_VERSION,
    activeBoardId: defaultBoardId,
    onboardingDone: false,
    boards: {},
  };
}

function normalizeStage(prev, unlockedDefault) {
  const base = emptyStage(unlockedDefault);
  if (!prev || typeof prev !== 'object') return base;
  const recent = Array.isArray(prev.recentRuns)
    ? prev.recentRuns
      .filter((r) => r && typeof r.wpm === 'number')
      .slice(-RECENT_RUNS_MAX)
      .map((r) => ({
        wpm: Number(r.wpm) || 0,
        accuracy: Number(r.accuracy) || 0,
        at: typeof r.at === 'string' ? r.at : new Date().toISOString(),
      }))
    : [];
  return {
    unlocked: !!prev.unlocked || unlockedDefault,
    bestWpm: Number(prev.bestWpm) || 0,
    bestAccuracy: Number(prev.bestAccuracy) || 0,
    timesPlayed: Number(prev.timesPlayed) || 0,
    // A stage is fluent only when one run meets both thresholds. Independent
    // all-time bests may have come from different runs and cannot be combined.
    fluent: !!prev.fluent || recent.some(
      (r) => r.wpm >= FLUENT_WPM && r.accuracy >= PASS_ACCURACY,
    ),
    recentRuns: recent,
    note: typeof prev.note === 'string' ? prev.note.slice(0, 500) : '',
    wpmGoal: Math.max(0, Number(prev.wpmGoal) || 0),
  };
}

function normalizeMetricMap(raw, transition = false) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    if (transition) {
      const count = Math.max(0, Number(value.count) || 0);
      if (count) out[key] = {
        count,
        errors: Math.max(0, Number(value.errors) || 0),
        totalLatencyMs: Math.max(0, Number(value.totalLatencyMs) || 0),
      };
      continue;
    }
    const attempts = Math.max(0, Number(value.attempts) || 0);
    const correct = Math.max(0, Number(value.correct) || 0);
    const errors = Math.max(0, Number(value.errors) || 0);
    const samples = Math.max(0, Number(value.samples) || 0);
    if (attempts || correct || errors || samples) {
      out[key] = {
        attempts, correct, errors, samples,
        totalLatencyMs: Math.max(0, Number(value.totalLatencyMs) || 0),
      };
    }
  }
  return out;
}

/**
 * @param {string[]} stageIds
 * @param {{getItem: Function, setItem: Function}} [backing]
 * @param {{ defaultBoardId?: string, unlockAfterById?: Record<string, string> }} [opts]
 */
export function createStorage(stageIds, backing = globalThis.localStorage, opts = {}) {
  const defaultBoardId = opts.defaultBoardId || 'eyelash-sofle';
  const unlockAfterById = opts.unlockAfterById && typeof opts.unlockAfterById === 'object'
    ? opts.unlockAfterById
    : {};

  function stagePassed(s) {
    return !!s && (Number(s.bestAccuracy) || 0) >= PASS_ACCURACY;
  }

  /** Propagate unlocks along the linear chain and parallel unlockAfter edges. Never re-locks. */
  function applyUnlocks(bp, linearOverride) {
    const linear = (Array.isArray(linearOverride) && linearOverride.length
      ? linearOverride
      : stageIds.filter((id) => !unlockAfterById[id])
    ).filter((id) => bp.stages[id]);

    if (linear.length) bp.stages[linear[0]].unlocked = true;
    for (let i = 0; i < linear.length - 1; i++) {
      if (stagePassed(bp.stages[linear[i]])) bp.stages[linear[i + 1]].unlocked = true;
    }
    for (const [id, after] of Object.entries(unlockAfterById)) {
      if (bp.stages[id] && stagePassed(bp.stages[after])) bp.stages[id].unlocked = true;
    }
  }

  function readRaw() {
    try {
      const raw = backing.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* corrupt */ }
    return null;
  }

  function write(root) {
    backing.setItem(STORE_KEY, JSON.stringify(root));
  }

  function migrateBoardProgress(rawBoard) {
    const out = emptyBoardProgress();
    const incoming = {};

    if (rawBoard && typeof rawBoard === 'object') {
      Object.assign(incoming, rawBoard.stages || {});
      for (const [from, to] of Object.entries(RENAMES)) {
        if (incoming[from] && !incoming[to]) incoming[to] = incoming[from];
        delete incoming[from];
      }
      if (rawBoard.heatmap && typeof rawBoard.heatmap === 'object') {
        for (const [ch, n] of Object.entries(rawBoard.heatmap)) {
          if (typeof n === 'number' && n > 0) out.heatmap[ch] = n;
        }
      }
      out.keyMetrics = normalizeMetricMap(rawBoard.keyMetrics);
      out.transitionMetrics = normalizeMetricMap(rawBoard.transitionMetrics, true);
      if (Array.isArray(rawBoard.sessionRuns)) {
        out.sessionRuns = rawBoard.sessionRuns
          .filter((r) => r && typeof r.wpm === 'number' && typeof r.at === 'string')
          .slice(-20)
          .map((r) => ({
            wpm: Math.max(0, Number(r.wpm) || 0),
            accuracy: Math.max(0, Number(r.accuracy) || 0),
            avgLatencyMs: Math.max(0, Number(r.avgLatencyMs) || 0),
            at: r.at,
          }));
      }
      if (rawBoard.streak && typeof rawBoard.streak === 'object') {
        out.streak = {
          lastDate: typeof rawBoard.streak.lastDate === 'string' ? rawBoard.streak.lastDate : '',
          count: Number(rawBoard.streak.count) || 0,
        };
      }
      if (Array.isArray(rawBoard.customLists)) {
        out.customLists = rawBoard.customLists
          .filter((l) => l && typeof l.name === 'string' && Array.isArray(l.items))
          .map((l, i) => ({
            id: typeof l.id === 'string' ? l.id : `list-${i}`,
            name: String(l.name).slice(0, 80),
            items: l.items.filter((x) => typeof x === 'string' && x.length > 0).slice(0, 500),
          }));
      }
      if (rawBoard.settings && typeof rawBoard.settings === 'object') {
        const defaults = defaultSettings();
        for (const key of Object.keys(defaults)) {
          if (typeof rawBoard.settings[key] === 'boolean') defaults[key] = rawBoard.settings[key];
        }
        out.settings = defaults;
      }
    }
    if (typeof rawBoard?.settings?.soundEnabled !== 'boolean') {
      try {
        const legacySound = backing.getItem(LEGACY_SOUND_KEY);
        if (legacySound != null) out.settings.soundEnabled = legacySound !== '0';
      } catch { /* unavailable backing */ }
    }

    const linearIds = stageIds.filter((id) => !unlockAfterById[id]);
    for (let i = 0; i < stageIds.length; i++) {
      const id = stageIds[i];
      const isFirstLinear = linearIds[0] === id;
      out.stages[id] = normalizeStage(incoming[id], isFirstLinear);
    }

    applyUnlocks(out);

    return out;
  }

  function migrateRoot(raw) {
    const root = emptyRoot(defaultBoardId);
    if (!raw || typeof raw !== 'object') {
      root.boards[defaultBoardId] = migrateBoardProgress(null);
      return root;
    }

    root.onboardingDone = !!raw.onboardingDone;

    if (raw.boards && typeof raw.boards === 'object') {
      root.activeBoardId = typeof raw.activeBoardId === 'string' ? raw.activeBoardId : defaultBoardId;
      for (const [id, bp] of Object.entries(raw.boards)) {
        root.boards[id] = migrateBoardProgress(bp);
      }
      if (!root.boards[root.activeBoardId]) {
        root.boards[root.activeBoardId] = migrateBoardProgress(null);
      }
      if (!root.boards[defaultBoardId]) {
        root.boards[defaultBoardId] = migrateBoardProgress(null);
      }
      root.version = SCHEMA_VERSION;
      return root;
    }

    root.activeBoardId = defaultBoardId;
    root.boards[defaultBoardId] = migrateBoardProgress(raw);
    root.version = SCHEMA_VERSION;
    return root;
  }

  function loadRoot() {
    const before = readRaw();
    const root = migrateRoot(before);
    if (JSON.stringify(before) !== JSON.stringify(root)) write(root);
    return root;
  }

  function boardView(boardId) {
    const root = loadRoot();
    const id = boardId || root.activeBoardId || defaultBoardId;
    if (!root.boards[id]) {
      root.boards[id] = migrateBoardProgress(null);
      write(root);
    }
    const bp = root.boards[id];
    return {
      version: SCHEMA_VERSION,
      activeBoardId: root.activeBoardId,
      boardId: id,
      onboardingDone: root.onboardingDone,
      stages: bp.stages,
      heatmap: bp.heatmap,
      keyMetrics: bp.keyMetrics,
      transitionMetrics: bp.transitionMetrics,
      sessionRuns: bp.sessionRuns,
      streak: bp.streak,
      customLists: bp.customLists,
      settings: bp.settings,
    };
  }

  function load(boardId = null) {
    return boardView(boardId);
  }

  function patchBoard(boardId, fn) {
    const root = loadRoot();
    const id = boardId || root.activeBoardId || defaultBoardId;
    if (!root.boards[id]) root.boards[id] = migrateBoardProgress(null);
    fn(root.boards[id], root);
    write(root);
    return boardView(id);
  }

  function setActiveBoard(boardId) {
    const root = loadRoot();
    root.activeBoardId = boardId;
    if (!root.boards[boardId]) root.boards[boardId] = migrateBoardProgress(null);
    write(root);
    return boardView(boardId);
  }

  function getActiveBoardId() {
    return loadRoot().activeBoardId || defaultBoardId;
  }

  function touchStreak(bp) {
    const today = todayKey();
    const { lastDate, count } = bp.streak;
    if (lastDate === today) return;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = todayKey(y);
    if (lastDate === yesterday) {
      bp.streak = { lastDate: today, count: count + 1 };
    } else {
      bp.streak = { lastDate: today, count: 1 };
    }
  }

  function saveResult(stageId, wpm, accuracy, mistakes = {}, opts = {}) {
    const root = loadRoot();
    const boardId = opts.boardId || root.activeBoardId || defaultBoardId;
    if (!root.boards[boardId]) root.boards[boardId] = migrateBoardProgress(null);
    const bp = root.boards[boardId];

    touchStreak(bp);

    for (const [ch, n] of Object.entries(mistakes)) {
      if (typeof n === 'number' && n > 0) bp.heatmap[ch] = (bp.heatmap[ch] ?? 0) + n;
    }

    const runMetrics = opts.metrics || {};
    for (const [ch, incoming] of Object.entries(runMetrics.keyMetrics || {})) {
      if (!incoming || typeof incoming !== 'object') continue;
      const current = bp.keyMetrics[ch] || {
        attempts: 0, correct: 0, errors: 0, totalLatencyMs: 0, samples: 0,
      };
      for (const key of ['attempts', 'correct', 'errors', 'totalLatencyMs', 'samples']) {
        current[key] += Math.max(0, Number(incoming[key]) || 0);
      }
      bp.keyMetrics[ch] = current;
    }
    for (const [kind, incoming] of Object.entries(runMetrics.transitionMetrics || {})) {
      if (!incoming || typeof incoming !== 'object') continue;
      const current = bp.transitionMetrics[kind] || { count: 0, errors: 0, totalLatencyMs: 0 };
      current.count += Math.max(0, Number(incoming.count) || 0);
      current.errors += Math.max(0, Number(incoming.errors) || 0);
      current.totalLatencyMs += Math.max(0, Number(incoming.totalLatencyMs) || 0);
      bp.transitionMetrics[kind] = current;
    }
    bp.sessionRuns = [
      ...(bp.sessionRuns || []),
      {
        wpm,
        accuracy,
        avgLatencyMs: Math.max(0, Number(runMetrics.avgLatencyMs) || 0),
        at: new Date().toISOString(),
      },
    ].slice(-20);

    const linear = Array.isArray(opts.unlockStageIds) && opts.unlockStageIds.length
      ? opts.unlockStageIds.filter((id) => stageIds.includes(id) && !unlockAfterById[id])
      : stageIds.filter((id) => !unlockAfterById[id]);
    const isNonProgress = !!(opts.practice || opts.sandbox || opts.weakKeys || opts.customList);

    // Ad-hoc runs (weak keys / custom lists without a real stage): heatmap + streak,
    // then heal unlocks from stored bestAccuracy.
    if (!stageId || !bp.stages[stageId]) {
      applyUnlocks(bp, linear);
      write(root);
      return { data: boardView(boardId), unlockedNext: false, fluentNow: false };
    }

    const s = bp.stages[stageId];
    const priorBestAccuracy = Number(s.bestAccuracy) || 0;
    s.timesPlayed += 1;
    s.bestWpm = Math.max(s.bestWpm, wpm);
    s.bestAccuracy = Math.max(s.bestAccuracy, accuracy);
    s.recentRuns = [
      ...(s.recentRuns || []),
      { wpm, accuracy, at: new Date().toISOString() },
    ].slice(-RECENT_RUNS_MAX);

    let fluentNow = false;
    if (accuracy >= PASS_ACCURACY && wpm >= FLUENT_WPM) {
      if (!s.fluent) fluentNow = true;
      s.fluent = true;
    }

    const idx = linear.indexOf(stageId);
    const nextId = idx >= 0 && idx + 1 < linear.length ? linear[idx + 1] : null;
    const nextWasLocked = !!(nextId && bp.stages[nextId] && !bp.stages[nextId].unlocked);

    // Practice / sandbox / weak / custom: heal from prior bestAccuracy only so a
    // brand-new pass on this run does not unlock the next stage. Normal runs use
    // the updated bestAccuracy (current run counts).
    if (isNonProgress) {
      const storedBest = s.bestAccuracy;
      s.bestAccuracy = priorBestAccuracy;
      applyUnlocks(bp, linear);
      s.bestAccuracy = storedBest;
    } else {
      applyUnlocks(bp, linear);
    }

    const unlockedNext = nextWasLocked && !!bp.stages[nextId]?.unlocked;

    write(root);
    return { data: boardView(boardId), unlockedNext, fluentNow };
  }

  function setStageNote(stageId, note, boardId = null) {
    return patchBoard(boardId, (bp) => {
      if (bp.stages[stageId]) bp.stages[stageId].note = String(note || '').slice(0, 500);
    });
  }

  function setWpmGoal(stageId, goal, boardId = null) {
    return patchBoard(boardId, (bp) => {
      if (bp.stages[stageId]) bp.stages[stageId].wpmGoal = Math.max(0, Math.round(Number(goal) || 0));
    });
  }

  function updateSettings(partial, boardId = null) {
    return patchBoard(boardId, (bp) => {
      bp.settings = { ...defaultSettings(), ...bp.settings, ...partial };
    });
  }

  function setOnboardingDone(done = true) {
    const root = loadRoot();
    root.onboardingDone = !!done;
    write(root);
    return boardView();
  }

  function saveCustomList(list, boardId = null) {
    return patchBoard(boardId, (bp) => {
      const id = list.id || `list-${Date.now()}`;
      const entry = {
        id,
        name: String(list.name || 'Custom list').slice(0, 80),
        items: (list.items || []).filter((x) => typeof x === 'string' && x.length > 0).slice(0, 500),
      };
      const idx = bp.customLists.findIndex((l) => l.id === id);
      if (idx >= 0) bp.customLists[idx] = entry;
      else bp.customLists.push(entry);
      bp.customLists = bp.customLists.slice(0, 20);
    });
  }

  function deleteCustomList(listId, boardId = null) {
    return patchBoard(boardId, (bp) => {
      bp.customLists = bp.customLists.filter((l) => l.id !== listId);
    });
  }

  function reset(boardId = null) {
    const root = loadRoot();
    const id = boardId || root.activeBoardId || defaultBoardId;
    const keepSettings = root.boards[id]?.settings;
    root.boards[id] = migrateBoardProgress(null);
    if (keepSettings) root.boards[id].settings = keepSettings;
    write(root);
    return boardView(id);
  }

  function topMisses(limit = 8, boardId = null) {
    const data = load(boardId);
    return Object.entries(data.heatmap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function exportAll() {
    return JSON.stringify(loadRoot(), null, 2);
  }

  function importAll(json) {
    let parsed;
    try {
      parsed = typeof json === 'string' ? JSON.parse(json) : json;
    } catch {
      throw new Error('Invalid JSON');
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid progress file');
    const root = migrateRoot(parsed);
    write(root);
    return boardView();
  }

  return {
    load,
    saveResult,
    reset,
    topMisses,
    setActiveBoard,
    getActiveBoardId,
    loadRoot,
    setStageNote,
    setWpmGoal,
    updateSettings,
    setOnboardingDone,
    saveCustomList,
    deleteCustomList,
    exportAll,
    importAll,
  };
}
