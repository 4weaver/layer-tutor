// Renders the split-keyboard diagram and highlights the current target.
//
// Geometry comes from the board's own `positions` map (key id -> {x,y,w,h,r}
// in key-pitch units), generated for the real ZMK keymap by
// zmk-config/trainer/tools/gen_board.py. The case outline is computed from
// the key extents, so any board shape renders without hand-tuned outlines.

import { PRIMARY_BOARD } from './keyboardLayout.js';

const U = 3.55;
const KEY_GAP = 0.35;
const PAD = 0.40;

function geomFor(key, board) {
  const p = board.positions?.[key.id];
  if (p) return { x: p.x, y: p.y, w: p.w ?? 1, h: p.h ?? 1, r: p.r ?? 0 };
  return { x: key.col ?? 0, y: key.row ?? 0, w: 1, h: 1, r: 0 };
}

function halfExtents(keys, board, half) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of keys.filter((k) => k.half === half)) {
    const g = geomFor(key, board);
    minX = Math.min(minX, g.x);
    minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w);
    maxY = Math.max(maxY, g.y + g.h);
  }
  if (!Number.isFinite(minX)) {
    return { minX: -PAD, minY: -PAD, maxX: 6 + PAD, maxY: 4 + PAD };
  }
  return { minX, minY, maxX, maxY };
}

function roundedPath(pts, radius) {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const v1 = [p1[0] - p0[0], p1[1] - p0[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    const r1 = Math.min(radius, l1 / 2);
    const r2 = Math.min(radius, l2 / 2);
    const a = [p1[0] - (v1[0] / l1) * r1, p1[1] - (v1[1] / l1) * r1];
    const b = [p1[0] + (v2[0] / l2) * r2, p1[1] + (v2[1] / l2) * r2];
    d += (i === 0 ? 'M' : 'L') + ' ' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' ';
    d += 'Q ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + ' ';
  }
  return d + 'Z';
}

function caseSvg(half, ex) {
  const W = ex.maxX - ex.minX;
  const H = ex.maxY - ex.minY;
  const pad = PAD;
  const pts = [
    [ex.minX - pad, ex.minY - pad],
    [ex.maxX + pad, ex.minY - pad],
    [ex.maxX + pad, ex.maxY + pad],
    [ex.minX - pad, ex.maxY + pad],
  ].map(([x, y]) => [(x - ex.minX) * 100, (y - ex.minY) * 100]);
  const gradId = 'kb-case-grad-' + half;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'kb-case');
  svg.setAttribute('viewBox', '0 0 ' + (W * 100) + ' ' + (H * 100));
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<defs>' +
      '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0.35" y2="1">' +
        '<stop offset="0" stop-color="#141924"/>' +
        '<stop offset="0.65" stop-color="#090c12"/>' +
      '</linearGradient>' +
    '</defs>' +
    '<path d="' + roundedPath(pts, 18) + '" fill="url(#' + gradId + ')"' +
          ' stroke="#242d40" stroke-width="2.5"/>';
  return svg;
}

function leftGlow(col) {
  const hue = 175 + ((220 - 175) * col) / 6;
  return 'hsl(' + hue.toFixed(0) + ' 100% 55% / 0.6)';
}

function rightGlow(col) {
  const stops = [270, 330, 375, 410, 480];
  const t = (col / 6) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t));
  const frac = t - i;
  const hue = (stops[i] + (stops[i + 1] - stops[i]) * frac) % 360;
  return 'hsl(' + hue.toFixed(0) + ' 100% 55% / 0.6)';
}

function glowFor(key, g) {
  const col = Math.round(Math.min(6, Math.max(0, g.x)));
  return key.half === 'L' ? leftGlow(col) : rightGlow(col);
}

/** Base-layer legend of a key id (or null). */
function keyLegend(board, id) {
  return board?.KEYS?.find((k) => k.id === id)?.legends?.[0] ?? null;
}

/**
 * Mount a keyboard into `container`.
 * @param {HTMLElement} container
 * @param {object} [board] board from the registry (defaults to Lily58)
 * @returns {{ highlightTarget: (target: object|null) => void, destroy: () => void }}
 */
export function renderKeyboard(container, board = PRIMARY_BOARD) {
  const KEYS = board.KEYS;
  const LAYER_HOLD = board.LAYER_HOLD;
  const shiftKeysFor = board.shiftKeysFor.bind(board);
  const HOME_IDS = board.homeIds ?? [];

  const keyEls = new Map();
  const halfEls = new Map();

  container.innerHTML = '';
  container.setAttribute('role', 'img');
  container.setAttribute(
    'aria-label',
    (board.name || 'Split') + ' keyboard diagram showing the target key',
  );

  for (const half of ['L', 'R']) {
    const ex = halfExtents(KEYS, board, half);
    const WU = ex.maxX - ex.minX;
    const HU = ex.maxY - ex.minY;
    const halfEl = document.createElement('div');
    halfEl.className = 'kb-half kb-half-' + half;
    halfEl.dataset.half = half;
    halfEl.style.width = (WU * U).toFixed(2) + 'rem';
    halfEl.style.height = (HU * U).toFixed(2) + 'rem';
    halfEl.appendChild(caseSvg(half, ex));

    for (const key of KEYS.filter((k) => k.half === half)) {
      const g = geomFor(key, board);
      const el = document.createElement('div');
      el.className = 'kb-key';
      el.dataset.keyId = key.id;
      el.style.left = ((g.x - ex.minX) * U + KEY_GAP / 2).toFixed(2) + 'rem';
      el.style.top = ((g.y - ex.minY) * U + KEY_GAP / 2).toFixed(2) + 'rem';
      el.style.width = (g.w * U - KEY_GAP).toFixed(2) + 'rem';
      el.style.height = (g.h * U - KEY_GAP).toFixed(2) + 'rem';
      if (g.r) el.style.setProperty('--rot', g.r + 'deg');
      el.style.setProperty('--glow', glowFor(key, g));

      const legend = document.createElement('span');
      legend.className = 'kb-legend';
      el.appendChild(legend);

      const badge = document.createElement('span');
      badge.className = 'kb-badge';
      badge.hidden = true;
      el.appendChild(badge);

      halfEl.appendChild(el);
      keyEls.set(key.id, el);
    }
    container.appendChild(halfEl);
    halfEls.set(half, halfEl);
  }

  /** Paint the permanent base-keycap legends. */
  function paintLegends() {
    container.dataset.displayLayer = '0';
    for (const key of KEYS) {
      const el = keyEls.get(key.id);
      const text = key.legends[0];
      const legendEl = el.querySelector('.kb-legend');
      legendEl.textContent = text ?? '';
      el.classList.toggle('kb-key-blank', text == null);
      el.classList.toggle('kb-key-wide-legend', (text ?? '').length > 1);
      el.classList.remove('kb-layer-plane', 'kb-layer-output');
    }
  }

  function paintBaseLegends() {
    paintLegends();
  }

  function clearHighlights() {
    for (const el of keyEls.values()) {
      el.classList.remove('kb-target', 'kb-hold', 'kb-shift', 'kb-layer-output');
      const badge = el.querySelector('.kb-badge');
      badge.hidden = true;
      badge.textContent = '';
    }
  }

  /**
   * @param {object|null} target  { keyId, layer, shift }
   */
  function highlightTarget(target) {
    clearHighlights();
    for (const halfEl of halfEls.values()) {
      halfEl.classList.remove('kb-active-half', 'kb-support-half', 'kb-needed-half');
    }

    if (!target) {
      paintLegends();
      return;
    }

    // Base legends never move. Layer output overlays the green target only.
    paintLegends();
    const targetHalf = target.keyId?.[0];
    for (const [half, halfEl] of halfEls) {
      halfEl.classList.add(half === targetHalf ? 'kb-active-half' : 'kb-support-half');
    }

    const targetEl = keyEls.get(target.keyId);
    if (targetEl) {
      targetEl.classList.add('kb-target');
      if (target.layer > 0) {
        const key = KEYS.find((k) => k.id === target.keyId);
        const out = key?.legends[target.layer];
        if (out) {
          targetEl.querySelector('.kb-legend').textContent = out;
          targetEl.classList.add('kb-layer-output');
          targetEl.classList.toggle('kb-key-wide-legend', out.length > 1);
          targetEl.classList.remove('kb-key-blank');
        }
      } else if (target.shift && target.layer === 0) {
        const key = KEYS.find((k) => k.id === target.keyId);
        const base = key?.legends[0];
        if (base && base.length === 1 && /[a-z]/i.test(base)) {
          targetEl.querySelector('.kb-legend').textContent = base.toUpperCase();
        }
      }
    }

    if (target.layer > 0) {
      const holdId = LAYER_HOLD[target.layer];
      const holdEl = keyEls.get(holdId);
      if (holdEl) {
        holdEl.classList.add('kb-hold');
        holdEl.closest('.kb-half')?.classList.add('kb-needed-half');
        const badge = holdEl.querySelector('.kb-badge');
        badge.hidden = false;
        badge.textContent = 'HOLD ' + (keyLegend(board, holdId) ?? '');
      }
    }
    if (target.shift) {
      for (const id of board.SHIFT_KEYS ?? shiftKeysFor(target)) {
        const shiftEl = keyEls.get(id);
        if (shiftEl) {
          shiftEl.classList.add('kb-shift');
          shiftEl.closest('.kb-half')?.classList.add('kb-needed-half');
          const badge = shiftEl.querySelector('.kb-badge');
          badge.hidden = false;
          badge.textContent = 'SHIFT';
        }
      }
    }
  }

  paintBaseLegends();

  function setHomeGhost(on) {
    for (const id of HOME_IDS) {
      keyEls.get(id)?.classList.toggle('kb-home-ghost', !!on);
    }
  }

  function setFocusMode(on, needsHold) {
    container.classList.toggle('kb-focus-mode', !!on);
    container.classList.toggle('kb-focus-expanded', !!(on && needsHold));
  }

  function setCollapsed(on) {
    container.classList.toggle('kb-collapsed', !!on);
  }

  /** Flash the key the user actually hit (if mappable). */
  function flashWrong(wrongCh, charToKeyFn) {
    if (wrongCh == null || !charToKeyFn) return;
    const m = charToKeyFn(wrongCh);
    if (!m) return;
    const el = keyEls.get(m.keyId);
    if (!el) return;
    el.classList.remove('kb-wrong-flash');
    void el.offsetWidth;
    el.classList.add('kb-wrong-flash');
    setTimeout(() => el.classList.remove('kb-wrong-flash'), 280);
  }

  /** Paint miss intensity as opacity on keycaps (0–1 scale from heatmap). */
  function paintHeatmap(heatmap) {
    const vals = Object.values(heatmap || {}).filter((n) => n > 0);
    const max = vals.length ? Math.max(...vals) : 0;
    for (const key of KEYS) {
      const el = keyEls.get(key.id);
      el?.style.removeProperty('--heat');
      el?.classList.remove('kb-heat');
    }
    if (!max) return;
    for (const [ch, n] of Object.entries(heatmap || {})) {
      if (!n) continue;
      for (const key of KEYS) {
        for (const layer of [0, 1, 2]) {
          const leg = key.legends[layer];
          if (!leg) continue;
          const match = layer === 0 ? leg.toLowerCase() === ch || leg === ch : leg === ch;
          if (match || (ch === ' ' && key.id === (board.KEYS.find((k) => k.legends[0] === 'Space')?.id))) {
            const el = keyEls.get(key.id);
            if (el) {
              const t = Math.min(1, n / max);
              el.style.setProperty('--heat', String(0.15 + t * 0.75));
              el.classList.add('kb-heat');
            }
            break;
          }
        }
      }
    }
  }

  /** Viewport rect of a key element, plus its half's rect, for canvas overlay effects. */
  function getKeyRect(keyId) {
    const el = keyEls.get(keyId);
    if (!el) return null;
    const halfEl = el.closest('.kb-half');
    return { rect: el.getBoundingClientRect(), halfRect: halfEl?.getBoundingClientRect() ?? null };
  }

  return {
    highlightTarget,
    setHomeGhost,
    setFocusMode,
    setCollapsed,
    flashWrong,
    paintHeatmap,
    paintBaseLegends,
    getKeyRect,
    destroy() {
      clearHighlights();
      keyEls.clear();
      halfEls.clear();
      container.innerHTML = '';
    },
  };
}

/** Standalone mini heatmap board for the menu (reuses geometry via renderKeyboard). */
export function renderHeatmapBoard(container, board, heatmap) {
  const ctrl = renderKeyboard(container, board);
  ctrl.paintHeatmap(heatmap);
  ctrl.setHomeGhost(false);
  container.classList.add('kb-heatmap-view');
  return ctrl;
}

