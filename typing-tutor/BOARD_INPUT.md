# Board input contract

**Separation rule:** layer-tutor does **not** read zmk-config (or any keymap
repo) paths, and it is not tied to a single board. An external **exporter**
produces a board declaration; this app only **consumes** that file.

Today the cleanest existing shape is the object that
`zmk-config/trainer/tools/gen_board.py` embeds into `js/boards/<id>.js`
(LEFT/RIGHT matrices + `createLayout` args + metadata/`positions`). The same
fields can live as JSON and be turned into a runtime board via
`boardFromDeclaration()` in `js/boards/buildLayout.js`.

## Who does what

| Role | Lives where | Responsibility |
|------|-------------|----------------|
| Exporter | Outside this repo (e.g. `zmk-config/trainer/tools/gen_board.py`) | Parse keymap / layout source; emit declaration JS or JSON |
| Consumer | This repo (`typing-tutor`) | Load declaration → `boardFromDeclaration` / register in `js/boards/` → render + tutor |

Do **not** hard-code exporter repo paths inside the tutor. Pass a file path or
drop a generated module under `js/boards/`.

## Declaration shape (JSON or equivalent JS object)

```jsonc
{
  "id": "my-board",                 // required, registry key
  "name": "My Board",               // UI short label
  "productName": "…",
  "formFactor": "…",
  "description": "…",
  "geometry": "my-board",           // free-form profile id
  "vilPath": null,                  // optional Vial path; null for ZMK-generated
  "comingSoon": false,
  "homeIds": ["L21", "L22", "…"],   // home-row key ids for ghost highlight
  "positions": {                    // key id → {x,y,w?,h?,r?} in key-pitch "u"
    "L00": { "x": 0, "y": 0.05 },
    "L42": { "x": 4.5, "y": 4.05, "w": 1, "h": 1.5 }
  },
  "left": [                         // rows of [id, L0, L1, L2] legends (null ok)
    [["L00", "Esc", "Tab", "Tab"], …],
    …
  ],
  "right": [ … ],
  "layerHold": { "1": "L31" },      // layer number → hold key id (hold-tap OK)
  "shiftKeys": ["L20"],
  "spaceKeyId": "L42",
  "shiftedL0": { ":": ";", "?": "/" }  // optional shift pairs
}
```

### Legend slots

- **L0** — base / tap character painted on the keycap and mapped for typing.
- **L1 / L2** — held-layer output (shown when that layer is the target).
- Hold-tap keys listed in `layerHold` still contribute their **L0 tap** to the
  char map; only L1/L2 on that key are excluded as typeable output.

### Positions

- Preferred for any generated ZMK board. Units are key-pitch (“u”).
- If `positions` is missing/null (e.g. stock Corne V4), the renderer keeps the
  legacy Corne stagger + thumb fan so Corne stays visually correct.

## How the tutor loads a board

1. **Checked-in module (current default):** `js/boards/<id>.js` exports
   `board` built with `createLayout` / `boardFromDeclaration`, then
   `js/boards/index.js` registers it in `BOARDS`.
2. **JSON declaration (supported helper):** read JSON →
   `boardFromDeclaration(decl)` → push onto `BOARDS` (wiring for a runtime
   file picker / URL is follow-up; the helper is the contract).

```js
import { boardFromDeclaration } from './boards/buildLayout.js';
const board = boardFromDeclaration(await fetch('board.json').then((r) => r.json()));
```

## Explicit non-goals

- Parsing `.keymap` / Vial inside this repo.
- Inventing key bindings for boards the exporter has not declared
  (e.g. eyelash Sofle NAV trigger must come from the declaration).
- Coupling `DEFAULT_BOARD_ID` to a single personal keymap.
