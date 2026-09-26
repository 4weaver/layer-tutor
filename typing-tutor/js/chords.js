// Chord token parsing + KeyboardEvent matching for home-row mod combo drills.
// Pool tokens look like "Ctrl+c", "Alt+f", "GUI+s", "Shift+z", "Ctrl+Shift+c".

const MOD_ALIASES = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  opt: 'alt',
  option: 'alt',
  gui: 'gui',
  cmd: 'gui',
  meta: 'gui',
  win: 'gui',
  super: 'gui',
  shift: 'shift',
};

const MOD_LABELS = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  gui: 'GUI',
  shift: 'Shift',
};

/** Display order for multi-mod labels. */
const MOD_ORDER = ['ctrl', 'alt', 'gui', 'shift'];

const BARE_MOD_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift']);

/**
 * @param {unknown} str
 * @returns {boolean}
 */
export function isChordToken(str) {
  if (typeof str !== 'string' || !str.includes('+')) return false;
  try {
    parseChord(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} str
 * @returns {{ mods: Set<'ctrl'|'alt'|'gui'|'shift'>, key: string, label: string }}
 */
export function parseChord(str) {
  if (typeof str !== 'string') throw new Error('chord must be a string');
  const parts = str.split('+').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) throw new Error(`chord needs mods+key: ${JSON.stringify(str)}`);

  const keyRaw = parts[parts.length - 1];
  const modParts = parts.slice(0, -1);
  /** @type {Set<'ctrl'|'alt'|'gui'|'shift'>} */
  const mods = new Set();
  for (const m of modParts) {
    const canon = MOD_ALIASES[m.toLowerCase()];
    if (!canon) throw new Error(`unknown mod ${JSON.stringify(m)} in ${JSON.stringify(str)}`);
    mods.add(canon);
  }
  if (!mods.size) throw new Error(`no mods in ${JSON.stringify(str)}`);

  // Single-character keys are normalized to lowercase for matching.
  if (keyRaw.length !== 1) {
    throw new Error(`chord key must be one character: ${JSON.stringify(str)}`);
  }
  const key = keyRaw.toLowerCase();

  const labelMods = MOD_ORDER.filter((m) => mods.has(m)).map((m) => MOD_LABELS[m]);
  const keyLabel = /[a-z]/.test(key) ? key.toUpperCase() : key;
  const label = `${labelMods.join('+')}+${keyLabel}`;

  return { mods, key, label };
}

/**
 * True when the event is a modifier key alone (no character key yet).
 * @param {Pick<KeyboardEvent, 'key'>} e
 */
export function isBareModifierEvent(e) {
  return BARE_MOD_KEYS.has(e.key);
}

/**
 * @param {Pick<KeyboardEvent, 'key'|'ctrlKey'|'altKey'|'metaKey'|'shiftKey'>} e
 * @param {{ mods: Set<string>, key: string }} chord
 */
export function eventMatchesChord(e, chord) {
  if (!chord || isBareModifierEvent(e)) return false;

  const wantCtrl = chord.mods.has('ctrl');
  const wantAlt = chord.mods.has('alt');
  const wantGui = chord.mods.has('gui');
  const wantShift = chord.mods.has('shift');

  if (!!e.ctrlKey !== wantCtrl) return false;
  if (!!e.altKey !== wantAlt) return false;
  if (!!e.metaKey !== wantGui) return false;
  if (!!e.shiftKey !== wantShift) return false;

  if (typeof e.key !== 'string' || e.key.length !== 1) return false;
  return e.key.toLowerCase() === chord.key.toLowerCase();
}

/**
 * Resolve board highlight for a chord: tap key + preferred same-hand HRM holds.
 * @param {object} board  runtime board with charToKey + homeRowMods
 * @param {{ mods: Set<string>, key: string }} chord
 * @returns {{ keyId: string, layer: number, shift: boolean, modHolds: string[] } | null}
 */
export function chordHighlightTarget(board, chord) {
  if (!board || !chord) return null;
  const tap =
    board.charToKey(chord.key) ||
    board.charToKey(chord.key.toLowerCase()) ||
    board.charToKey(chord.key.toUpperCase());
  if (!tap) return null;

  const tapHalf = tap.keyId?.[0];
  const modHolds = [];
  const hrm = board.homeRowMods || {};
  for (const mod of MOD_ORDER) {
    if (!chord.mods.has(mod)) continue;
    const ids = hrm[mod] || [];
    if (!ids.length) continue;
    const same = ids.find((id) => id[0] === tapHalf);
    modHolds.push(same || ids[0]);
  }

  return {
    keyId: tap.keyId,
    layer: 0,
    // Shift via HRM is drawn as modHolds, not the dedicated Shift keycap.
    shift: false,
    modHolds,
  };
}

/**
 * Pack flat chord tokens into lines (arrays of tokens) for B-mode Enter gating.
 * @param {string[]} chords
 * @param {number} [perLine=4]
 * @returns {string[][]}
 */
export function packChordLines(chords, perLine = 4) {
  const n = Math.max(1, perLine | 0);
  const lines = [];
  const list = (chords || []).filter((c) => typeof c === 'string' && c.trim());
  for (let i = 0; i < list.length; i += n) {
    lines.push(list.slice(i, i + n));
  }
  return lines;
}
