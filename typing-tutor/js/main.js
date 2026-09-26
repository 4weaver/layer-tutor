// App bootstrap and game orchestration.

import {
  STAGES, buildRound, PASS_ACCURACY, stagesForBoard,
  buildWeakKeyRound, buildCustomRound, contextualTip, coachFromMistakes,
  summarizeRunMetrics, toLinesAtoms,
} from './lessons.js';
import {
  getBoard, listPlayableBoards, DEFAULT_BOARD_ID, boardFullLabel,
} from './boards/index.js';
import {
  createGame, currentItem, currentChar, handleKey, stats, progressCounts, isLineArmed, advanceLine, countArmedMistake,
} from './gameEngine.js';
import { createStorage } from './storage.js';
import { renderKeyboard, renderHeatmapBoard } from './keyboardRenderer.js';
import * as sound from './sound.js';
import * as ui from './ui.js';
import { initEffects, signalFromKey, shortCircuitAtKey } from './canvasEffects.js';

const storage = createStorage(STAGES.map((s) => s.id), globalThis.localStorage, {
  defaultBoardId: DEFAULT_BOARD_ID,
});

let activeBoard = getBoard(storage.getActiveBoardId());
let progress = storage.load(activeBoard.id);
let stage = null;
let game = null;
let practice = false;
let runMode = 'stage'; // stage | practice | weak | sandbox | custom | onboard
let tickTimer = null;
let kb = null;
let heatKb = null;
let sandboxKb = null;
let paused = false;
let pauseStartedAt = null;
let pausedAccumMs = 0;
let boardUserCollapsed = false;
let lastResultStageId = null;
let onboardSeq = ['a', ' ', 's', 'd', 'f'];
let onboardIdx = 0;

const ARROWS = { ArrowLeft: '←', ArrowDown: '↓', ArrowUp: '↑', ArrowRight: '→' };

sound.initSound(progress.settings?.soundEnabled !== false);

function now() {
  return Date.now() - pausedAccumMs;
}

function settings() {
  return progress.settings || {
    focusMode: true,
    showHomeGhost: true,
    boardCollapsed: false,
    reducedBoardAuto: true,
    soundEnabled: true,
  };
}

function goMenu() {
  stopTick();
  setPaused(false);
  game = null;
  runMode = 'stage';
  stage = null;
  kb?.destroy();
  kb = null;
  sandboxKb?.destroy();
  sandboxKb = null;
  progress = storage.load(activeBoard.id);
  sound.setSoundEnabled(progress.settings?.soundEnabled !== false);

  if (!progress.onboardingDone) {
    startOnboarding();
    return;
  }

  ui.renderMenu(progress, startStage, storage.topMisses(12, activeBoard.id), {
    boards: listPlayableBoards(),
    activeBoard,
    onBoardChange: switchBoard,
    onFocus: (focus) => {
      if (focus.kind === 'weak') {
        startStage({ id: '_weak', name: 'Weak keys', layerHint: '', coachTip: '', pool: [], roundSize: 24, track: 'mixed' }, { weakKeys: true });
        return;
      }
      const suggested = stagesForBoard(activeBoard.id).find((s) => s.id === focus.stageId)
        || STAGES.find((s) => s.id === focus.stageId);
      if (suggested) startStage(suggested, { practice: false });
    },
  });

  // Heatmap mini board
  const heatHost = document.getElementById('heatmap-board');
  if (heatHost && Object.keys(progress.heatmap || {}).length) {
    heatKb?.destroy();
    heatKb = renderHeatmapBoard(heatHost, activeBoard, progress.heatmap);
  } else if (heatHost) {
    heatHost.innerHTML = '';
  }

  ui.showScreen('screen-menu');
  syncSoundToggle();
  wireSettings();
}

function switchBoard(boardId) {
  if (boardId === activeBoard.id) return;
  activeBoard = getBoard(boardId);
  progress = storage.setActiveBoard(activeBoard.id);
  ui.announce(`Board: ${boardFullLabel(activeBoard)}`);
  goMenu();
}

function wireSettings() {
  const map = [
    ['set-focus-mode', 'focusMode'],
    ['set-home-ghost', 'showHomeGhost'],
    ['set-board-collapsed', 'boardCollapsed'],
    ['set-reduced-auto', 'reducedBoardAuto'],
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.onchange = () => {
      progress = storage.updateSettings({ [key]: el.checked }, activeBoard.id);
      if (key === 'boardCollapsed') boardUserCollapsed = el.checked;
    };
  }
}

function applyBoardChrome(target) {
  const s = settings();
  const needsHold = !!(target && (target.layer > 0 || target.shift));
  kb?.setHomeGhost(s.showHomeGhost);
  const collapsed = boardUserCollapsed || s.boardCollapsed;
  if (s.focusMode) {
    kb?.setFocusMode(true, needsHold);
    if (s.reducedBoardAuto) {
      kb?.setCollapsed(collapsed && !needsHold);
    } else {
      kb?.setCollapsed(collapsed);
    }
  } else {
    kb?.setFocusMode(false, false);
    kb?.setCollapsed(collapsed);
  }
  ui.setHoldMeter(needsHold && target?.layer > 0, 1);
}

function startStage(s, opts = {}) {
  stage = {
    ...s,
    _note: progress.stages[s.id]?.note || '',
    _wpmGoal: progress.stages[s.id]?.wpmGoal || 0,
  };
  runMode = opts.practice ? 'practice' : opts.weakKeys ? 'weak' : opts.customList ? 'custom' : 'stage';
  practice = runMode === 'practice' || runMode === 'weak' || runMode === 'custom';
  pausedAccumMs = 0;
  pauseStartedAt = null;
  paused = false;
  ui.setPaused(false);
  boardUserCollapsed = settings().boardCollapsed;

  let items;
  if (opts.weakKeys) {
    items = buildWeakKeyRound(
      progress.heatmap,
      (ch) => activeBoard.charToKey(ch),
      24,
      Math.random,
      progress.keyMetrics,
    );
    stage = {
      id: '_weak',
      name: 'Weak keys',
      layerHint: 'Heatmap-weighted drill',
      coachTip: 'These characters have been missing most. Slow is fine.',
      roundSize: items.length,
      pool: items,
      track: 'mixed',
      _note: '',
      _wpmGoal: 0,
    };
  } else if (opts.customList) {
    items = buildCustomRound(opts.customList.items, 20);
    stage = {
      id: '_custom',
      name: opts.customList.name,
      layerHint: 'Custom list',
      coachTip: 'Your words — same accuracy rules, no unlock side-effects.',
      roundSize: items.length,
      pool: items,
      track: 'mixed',
      _note: '',
      _wpmGoal: 0,
    };
  } else if (opts.drillMisses) {
    items = buildWeakKeyRound(
      opts.drillMisses,
      (ch) => activeBoard.charToKey(ch),
      20,
      Math.random,
      progress.keyMetrics,
    );
    stage = {
      ...s,
      id: s.id,
      name: `${s.name} · miss drill`,
      coachTip: 'Overweighting misses from your last run.',
      pool: items,
      roundSize: items.length,
      _note: progress.stages[s.id]?.note || '',
      _wpmGoal: progress.stages[s.id]?.wpmGoal || 0,
    };
    runMode = 'weak';
    practice = true;
  } else {
    // B-mode line pacing: a normal round == one reasonable session. Practice no longer
    // multiplies tokens (~120/144 -> too long); it plays the same round but free of unlock
    // side-effects. Line width defaults to 4 words (intro drills opt into 3 via stage).
    const count = s.roundSize;
    items = buildRound(s, Math.random, count);
  }

  // B-mode (uniform X): pack tokens into short LINES (words spaced, Enter after each)
  // and enable explicit line-advance. Stage.wordsPerLine overrides the default 4.
  const lines = toLinesAtoms(items, stage.wordsPerLine ?? 4);
  const effectiveItems = lines.length ? lines : (['a']);
  game = createGame(effectiveItems, now(), { lineGate: true });
  document.getElementById('game-stage-name').textContent =
    runMode === 'practice' ? `${stage.name} · practice` : stage.name;
  document.getElementById('layer-hint').textContent = stage.layerHint;
  document.getElementById('coach-tip').textContent = stage.coachTip;
  document.getElementById('game-board-label').textContent = activeBoard.name;

  ui.showScreen('screen-game');
  kb?.destroy();
  kb = renderKeyboard(document.getElementById('keyboard'), activeBoard);
  refresh();
  startTick();
  ui.announce(`Starting ${stage.name}`);
}

function refresh() {
  if (runMode === 'sandbox') return;
  const item = currentItem(game);
  if (item == null) return;
  const armed = isLineArmed(game);
  ui.renderPrompt(item, game.cursor, armed);
  const ch = currentChar(game);
  const target = armed ? null : activeBoard.charToKey(ch);
  kb?.highlightTarget(target);
  applyBoardChrome(target);
  if (armed) {
    ui.setContextTip('Line done — press Enter (⏎) for the next line.');
  } else {
    ui.setContextTip(contextualTip(ch, (c) => activeBoard.charToKey(c), stage?.coachTip));
  }
  const { frac } = progressCounts(game);
  ui.renderProgressBar(frac);
  const label = `${game.itemIndex + 1}/${game.items.length}`;
  ui.renderLiveStats(stats(game, now()), label, stage?._wpmGoal || 0);
}

function startTick() {
  stopTick();
  tickTimer = setInterval(() => {
    if (game && !game.done && !paused && game.startTime !== null && runMode !== 'sandbox') {
      ui.renderLiveStats(
        stats(game, now()),
        `${game.itemIndex + 1}/${game.items.length}`,
        stage?._wpmGoal || 0,
      );
    }
  }, 250);
}

function stopTick() {
  if (tickTimer != null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function setPaused(on) {
  if (on === paused) return;
  if (on) {
    if (!game || game.done || runMode === 'sandbox') return;
    paused = true;
    pauseStartedAt = Date.now();
    ui.setPaused(true);
    ui.announce('Paused.');
  } else {
    if (pauseStartedAt != null) {
      pausedAccumMs += Date.now() - pauseStartedAt;
      pauseStartedAt = null;
    }
    paused = false;
    ui.setPaused(false);
  }
}

function finishStage() {
  stopTick();
  setPaused(false);
  sound.playDone();
  const s = stats(game, now());
  const runAnalysis = summarizeRunMetrics(game, (c) => activeBoard.charToKey(c));
  const sessionStart = (progress.sessionRuns || []).find((run) => {
    const age = Date.now() - Date.parse(run.at);
    return age >= 0 && age <= 2 * 60 * 60 * 1000;
  }) || null;
  const prevBest = stage?.id && progress.stages[stage.id]
    ? { wpm: progress.stages[stage.id].bestWpm, accuracy: progress.stages[stage.id].bestAccuracy }
    : null;

  const isAdhoc = !stage?.id || stage.id.startsWith('_') || runMode === 'weak' || runMode === 'custom';
  const saveId = isAdhoc ? null : stage.id;
  const boardStages = stagesForBoard(activeBoard.id);
  const { data, fluentNow } = storage.saveResult(
    saveId,
    s.wpm,
    s.accuracy,
    game.mistakes,
    {
      practice: practice || isAdhoc || runMode !== 'stage',
      weakKeys: runMode === 'weak',
      customList: runMode === 'custom',
      boardId: activeBoard.id,
      metrics: runAnalysis,
      unlockStageIds: boardStages.map((x) => x.id),
    },
  );
  progress = data;
  lastResultStageId = stage.id;

  const realStage = boardStages.find((x) => x.id === stage.id)
    || STAGES.find((x) => x.id === stage.id);
  const idx = realStage ? boardStages.indexOf(realStage) : -1;
  const passed = s.accuracy >= PASS_ACCURACY;
  const hasNext = idx >= 0 && idx + 1 < boardStages.length
    && progress.stages[boardStages[idx + 1].id]?.unlocked;
  const fluent = realStage ? progress.stages[realStage.id]?.fluent : false;
  const recent = realStage ? (progress.stages[realStage.id]?.recentRuns || []) : [];

  if (realStage) {
    stage._note = progress.stages[realStage.id]?.note || '';
    stage._wpmGoal = progress.stages[realStage.id]?.wpmGoal || 0;
  }

  ui.renderResults(stage, s, game.mistakes, {
    passed: !isAdhoc && runMode === 'stage' ? passed : true,
    hasNext: !isAdhoc && runMode === 'stage' && hasNext,
    practice: practice || isAdhoc,
    fluent,
    fluentNow,
    boardName: activeBoard.name,
    previousBest: prevBest,
    coach: coachFromMistakes(game.mistakes, (c) => activeBoard.charToKey(c)),
    recentRuns: recent,
    runAnalysis,
    sessionDelta: sessionStart ? {
      wpm: s.wpm - sessionStart.wpm,
      accuracy: Math.round((s.accuracy - sessionStart.accuracy) * 10) / 10,
      latencyMs: sessionStart.avgLatencyMs && runAnalysis.avgLatencyMs
        ? runAnalysis.avgLatencyMs - sessionStart.avgLatencyMs
        : null,
    } : null,
  });
  ui.showScreen('screen-results');
  ui.announce(`${s.wpm} wpm, ${s.accuracy} percent`);
}

// ---- Sandbox ----
function startSandbox() {
  runMode = 'sandbox';
  game = null;
  document.getElementById('sandbox-board-label').textContent = activeBoard.name;
  document.getElementById('sandbox-prompt').textContent = 'Type freely…';
  document.getElementById('sandbox-tip').textContent = 'Diagram follows whatever you type.';
  sandboxKb?.destroy();
  sandboxKb = renderKeyboard(document.getElementById('sandbox-keyboard'), activeBoard);
  sandboxKb.setHomeGhost(settings().showHomeGhost);
  ui.showScreen('screen-sandbox');
}

function sandboxType(ch) {
  const prompt = document.getElementById('sandbox-prompt');
  if (prompt.textContent === 'Type freely…') prompt.textContent = '';
  // If loaded paste mode with cursor tracking
  if (sandboxLoad) {
    const target = sandboxLoad[sandboxCursor];
    if (ch === target) {
      const hitTarget = activeBoard.charToKey(ch);
      if (hitTarget) signalFromKey(sandboxKb?.getKeyRect(hitTarget.keyId), hitTarget.layer);
      sandboxCursor += 1;
      renderSandboxPrompt();
      sound.playCorrect();
      if (sandboxCursor >= sandboxLoad.length) {
        ui.announce('Paste complete.');
        sandboxLoad = null;
      }
    } else {
      sound.playError();
      sandboxKb?.flashWrong(ch, (c) => activeBoard.charToKey(c));
      const wrongTarget = activeBoard.charToKey(ch);
      if (wrongTarget) shortCircuitAtKey(sandboxKb?.getKeyRect(wrongTarget.keyId));
    }
    const nextCh = sandboxLoad ? sandboxLoad[sandboxCursor] : ch;
    const t = activeBoard.charToKey(nextCh);
    sandboxKb?.highlightTarget(t);
    const tip = document.getElementById('sandbox-tip');
    if (tip) {
      tip.textContent = contextualTip(
        nextCh,
        (c) => activeBoard.charToKey(c),
        'Type freely — green key follows.',
      );
    }
    return;
  }
  prompt.textContent += ch === ' ' ? '·' : ch;
  if (prompt.textContent.length > 80) prompt.textContent = prompt.textContent.slice(-60);
  const t = activeBoard.charToKey(ch);
  if (t) signalFromKey(sandboxKb?.getKeyRect(t.keyId), t.layer);
  sandboxKb?.highlightTarget(t);
  const tip = document.getElementById('sandbox-tip');
  if (tip) tip.textContent = contextualTip(ch, (c) => activeBoard.charToKey(c), '');
  sound.playCorrect();
}

let sandboxLoad = null;
let sandboxCursor = 0;

function renderSandboxPrompt() {
  const el = document.getElementById('sandbox-prompt');
  if (!sandboxLoad) return;
  el.innerHTML = '';
  [...sandboxLoad].forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '·' : ch;
    span.className = i < sandboxCursor ? 'ch typed' : i === sandboxCursor ? 'ch current' : 'ch pending';
    el.appendChild(span);
  });
}

// ---- Onboarding ----
function startOnboarding() {
  onboardIdx = 0;
  document.getElementById('onboard-board-label').textContent = boardFullLabel(activeBoard);
  renderOnboardPrompt();
  document.getElementById('btn-onboard-done').classList.add('hidden');
  document.getElementById('onboard-status').textContent = 'Press keys: a · space · s · d · f';
  ui.showScreen('screen-onboarding');
}

function renderOnboardPrompt() {
  const el = document.getElementById('onboard-prompt');
  el.innerHTML = '';
  onboardSeq.forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '·' : ch;
    span.className = i < onboardIdx ? 'ch typed' : i === onboardIdx ? 'ch current' : 'ch pending';
    el.appendChild(span);
  });
}

function onboardKey(ch) {
  if (ch === onboardSeq[onboardIdx]) {
    onboardIdx += 1;
    sound.playCorrect();
    renderOnboardPrompt();
    if (onboardIdx >= onboardSeq.length) {
      document.getElementById('onboard-status').textContent = 'Nice — you are ready.';
      document.getElementById('btn-onboard-done').classList.remove('hidden');
      sound.playDone();
    }
  } else {
    sound.playError();
  }
}

function finishOnboarding() {
  progress = storage.setOnboardingDone(true);
  goMenu();
}

// ---- Input ----
function keyToChar(e) {
  if (ARROWS[e.key]) return ARROWS[e.key];
  if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') return ' ';
  if (e.key.length === 1) return e.key;
  return null;
}

function isEditableControl(el) {
  return !!el?.closest?.('button, input, textarea, select, summary, a[href]');
}

function isGameScreen() {
  return !document.getElementById('screen-game')?.classList.contains('hidden');
}
function isSandboxScreen() {
  return !document.getElementById('screen-sandbox')?.classList.contains('hidden');
}
function isOnboardScreen() {
  return !document.getElementById('screen-onboarding')?.classList.contains('hidden');
}

// Esc is a base-layer key on the Corne (L00, next to Q) — stray hits are common,
// so pausing requires a deliberate double-tap; a single Esc always resumes.
const ESC_DOUBLE_TAP_MS = 400;
let lastEscAt = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isGameScreen() && game && !game.done) {
    e.preventDefault();
    if (paused) {
      setPaused(false);
      lastEscAt = 0;
    } else if (Date.now() - lastEscAt <= ESC_DOUBLE_TAP_MS) {
      setPaused(true);
      lastEscAt = 0;
    } else {
      lastEscAt = Date.now();
    }
    return;
  }
  if (paused) return;
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // B-mode: a completed line waits on an explicit Enter to advance to the next line.
  if (game && isLineArmed(game) && isGameScreen()) {
    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.key === 'NumpadEnter';
    e.preventDefault();
    e.stopPropagation();
    if (isEnter) {
      const r = advanceLine(game);
      if (r === 'done') finishStage();
      else refresh();
      return;
    }
    // Wrong key while Enter is due: do NOT silently forgive (confirmed UX).
    const ch2 = keyToChar(e);
    if (ch2 != null) {
      countArmedMistake(game);
      sound.playError();
      ui.flashEnter();
      ui.setContextTip('Line done — press Enter (⏎) to continue.');
    }
    return;
  }
  const ch = keyToChar(e);
  if (ch === null) return;

  if (isOnboardScreen()) {
    if (isEditableControl(e.target)) return;
    e.preventDefault();
    onboardKey(ch);
    return;
  }
  if (isSandboxScreen()) {
    if (isEditableControl(e.target)) return;
    e.preventDefault();
    sandboxType(ch);
    return;
  }
  if (!game || game.done || !isGameScreen()) return;
  if (isEditableControl(e.target)) return;

  e.preventDefault();
  e.stopPropagation();
  ui.focusTypingSurface();

  const typedTarget = activeBoard.charToKey(ch);
  const result = handleKey(game, ch, now());
  if (result === 'error') {
    sound.playError();
    ui.flashError();
    kb?.flashWrong(ch, (c) => activeBoard.charToKey(c));
    const wrongTarget = activeBoard.charToKey(ch);
    if (wrongTarget) shortCircuitAtKey(kb?.getKeyRect(wrongTarget.keyId));
    ui.renderLiveStats(stats(game, now()), `${game.itemIndex + 1}/${game.items.length}`, stage?._wpmGoal || 0);
    return;
  }
  if (typedTarget) signalFromKey(kb?.getKeyRect(typedTarget.keyId), typedTarget.layer);
  if (result === 'done') {
    finishStage();
    return;
  }
  sound.playCorrect();
  refresh();
});

document.addEventListener('keyup', (e) => {
  if (!isGameScreen() || !game || game.done || paused) return;
  if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter' || e.code === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
  }
});

window.addEventListener('blur', () => {
  if (game && !game.done && isGameScreen()) setPaused(true);
});
window.addEventListener('resize', () => ui.updateRotateHint());
window.matchMedia('(orientation: portrait)').addEventListener?.('change', () => ui.updateRotateHint());

// ---- Buttons ----
document.getElementById('btn-quit').addEventListener('click', goMenu);
document.getElementById('btn-menu').addEventListener('click', goMenu);
document.getElementById('btn-resume')?.addEventListener('click', () => setPaused(false));
document.getElementById('btn-retry').addEventListener('click', () => {
  if (runMode === 'weak') startStage(stage, { weakKeys: true });
  else if (runMode === 'custom') startStage(stage, { customList: { name: stage.name, items: stage.pool } });
  else startStage(STAGES.find((s) => s.id === stage.id) || stage, { practice });
});
document.getElementById('btn-next').addEventListener('click', () => {
  const chain = stagesForBoard(activeBoard.id);
  const idx = chain.findIndex((s) => s.id === stage.id);
  if (idx >= 0 && idx + 1 < chain.length) startStage(chain[idx + 1], { practice: false });
});
document.getElementById('btn-drill-misses')?.addEventListener('click', () => {
  if (!game?.mistakes) return;
  const real = STAGES.find((s) => s.id === stage.id) || stage;
  startStage(real, { drillMisses: game.mistakes });
});

document.getElementById('btn-weak-keys')?.addEventListener('click', () => {
  startStage({ id: '_weak', name: 'Weak keys', layerHint: '', coachTip: '', pool: [], roundSize: 24, track: 'mixed' }, { weakKeys: true });
});
document.getElementById('btn-sandbox')?.addEventListener('click', startSandbox);
document.getElementById('btn-sandbox-back')?.addEventListener('click', goMenu);
document.getElementById('btn-sandbox-clear')?.addEventListener('click', () => {
  sandboxLoad = null;
  document.getElementById('sandbox-prompt').textContent = 'Type freely…';
  document.getElementById('sandbox-paste').value = '';
  sandboxKb?.highlightTarget(null);
});
document.getElementById('btn-sandbox-load')?.addEventListener('click', () => {
  const raw = document.getElementById('sandbox-paste').value;
  if (!raw.trim()) return;
  const text = [...raw].filter((ch) => activeBoard.charToKey(ch)).join('');
  if (!text) {
    ui.announce('That paste has no characters mapped on this board.');
    return;
  }
  const skipped = [...raw].length - [...text].length;
  if (skipped) ui.announce(`Loaded paste; skipped ${skipped} unsupported character${skipped === 1 ? '' : 's'}.`);
  sandboxLoad = text;
  sandboxCursor = 0;
  renderSandboxPrompt();
  const t = activeBoard.charToKey(sandboxLoad[0]);
  sandboxKb?.highlightTarget(t);
  document.getElementById('sandbox-prompt')?.focus();
});

document.getElementById('btn-toggle-board')?.addEventListener('click', () => {
  boardUserCollapsed = !boardUserCollapsed;
  const t = game ? activeBoard.charToKey(currentChar(game)) : null;
  applyBoardChrome(t);
  document.getElementById('btn-toggle-board').setAttribute('aria-pressed', boardUserCollapsed ? 'true' : 'false');
});

document.getElementById('btn-onboard-skip')?.addEventListener('click', finishOnboarding);
document.getElementById('btn-onboard-done')?.addEventListener('click', finishOnboarding);

// Results note / goal
document.getElementById('btn-save-goal')?.addEventListener('click', () => {
  const id = stage?.id;
  if (!id || id.startsWith('_')) return;
  const goal = document.getElementById('wpm-goal').value;
  progress = storage.setWpmGoal(id, goal, activeBoard.id);
  stage._wpmGoal = progress.stages[id]?.wpmGoal || 0;
  ui.announce(`Goal set to ${stage._wpmGoal || 'none'}`);
});
document.getElementById('stage-note')?.addEventListener('change', () => {
  const id = stage?.id;
  if (!id || id.startsWith('_')) return;
  progress = storage.setStageNote(id, document.getElementById('stage-note').value, activeBoard.id);
});

// Export / import
document.getElementById('btn-export')?.addEventListener('click', () => {
  const blob = new Blob([storage.exportAll()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `layer-tutor-progress-${activeBoard.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('btn-import')?.addEventListener('click', () => {
  document.getElementById('import-file')?.click();
});
document.getElementById('import-file')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    progress = storage.importAll(text);
    activeBoard = getBoard(storage.getActiveBoardId());
    ui.announce('Progress imported.');
    goMenu();
  } catch (err) {
    ui.announce(`Import failed: ${err.message}`);
  }
  e.target.value = '';
});

// Custom lists
document.getElementById('btn-custom-list')?.addEventListener('click', () => {
  ui.renderCustomLists(progress.customLists, {
    onPlay: (list) => {
      ui.setModal('modal-lists', false);
      startStage({ id: '_custom', name: list.name, layerHint: '', coachTip: '', pool: list.items, roundSize: 20, track: 'mixed' }, { customList: list });
    },
    onDelete: (id) => {
      progress = storage.deleteCustomList(id, activeBoard.id);
      ui.renderCustomLists(progress.customLists, {
        onPlay: (list) => startStage({ id: '_custom', name: list.name, pool: list.items, roundSize: 20, track: 'mixed', layerHint: '', coachTip: '' }, { customList: list }),
        onDelete: (id2) => {
          progress = storage.deleteCustomList(id2, activeBoard.id);
        },
      });
    },
  });
  ui.setModal('modal-lists', true);
});
document.getElementById('btn-list-close')?.addEventListener('click', () => ui.setModal('modal-lists', false));
document.getElementById('btn-list-save')?.addEventListener('click', () => {
  const name = document.getElementById('list-name').value || 'Custom list';
  const items = document.getElementById('list-items').value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return;
  // Filter to mappable chars only
  const clean = items.filter((item) => [...item].every((ch) => activeBoard.charToKey(ch)));
  if (!clean.length) {
    ui.announce('No mappable items — check symbols against your board.');
    return;
  }
  progress = storage.saveCustomList({ name, items: clean }, activeBoard.id);
  document.getElementById('list-name').value = '';
  document.getElementById('list-items').value = '';
  ui.renderCustomLists(progress.customLists, {
    onPlay: (list) => {
      ui.setModal('modal-lists', false);
      startStage({ id: '_custom', name: list.name, pool: list.items, roundSize: 20, track: 'mixed', layerHint: '', coachTip: '' }, { customList: list });
    },
    onDelete: (id) => {
      progress = storage.deleteCustomList(id, activeBoard.id);
    },
  });
  ui.announce(`Saved “${name}” (${clean.length} items).`);
});

// Cheat sheet
document.getElementById('btn-cheat-sheet')?.addEventListener('click', () => {
  ui.renderCheatSheet(activeBoard);
  ui.setModal('modal-cheat', true);
});
document.getElementById('btn-cheat-close')?.addEventListener('click', () => ui.setModal('modal-cheat', false));

// Sound + reset
function syncSoundToggle() {
  const btn = document.getElementById('btn-sound');
  if (!btn) return;
  const on = sound.isSoundEnabled();
  btn.textContent = on ? 'Sound: on' : 'Sound: off';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
document.getElementById('btn-sound')?.addEventListener('click', () => {
  const enabled = sound.setSoundEnabled(!sound.isSoundEnabled());
  progress = storage.updateSettings({ soundEnabled: enabled }, activeBoard.id);
  syncSoundToggle();
});

const resetBtn = document.getElementById('btn-reset');
let resetArmed = null;
function disarmReset() {
  clearTimeout(resetArmed);
  resetArmed = null;
  if (resetBtn) {
    resetBtn.textContent = 'Reset this board’s progress';
    resetBtn.classList.remove('armed');
  }
}
resetBtn?.addEventListener('click', () => {
  if (resetArmed) {
    disarmReset();
    progress = storage.reset(activeBoard.id);
    goMenu();
    ui.announce(`Progress reset for ${activeBoard.name}.`);
  } else {
    resetBtn.textContent = `Click again to wipe ${activeBoard.name}`;
    resetBtn.classList.add('armed');
    resetArmed = setTimeout(disarmReset, 3000);
  }
});

// prefers-reduced-motion
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reduce-motion');
}

initEffects();

goMenu();
