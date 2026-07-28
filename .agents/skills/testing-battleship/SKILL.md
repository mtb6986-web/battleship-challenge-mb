---
name: testing-battleship
description: How to run and manually test the static Battleship vs. AI browser game (Vite, no backend), including URL flags, known UI traps, and clipboard/mobile verification tricks.
---

# Testing the Battleship game

## Running it

- Static Vite app, no backend/DB/login: `npx vite --port 5173` from the repo root
  (log to `/tmp/vite.log`), then open `http://localhost:5173/`.
- Nothing is persisted: reloading mid-battle intentionally returns to a fresh
  placement phase. Don't report that as a bug.

## URL flags (verify these first, they make everything else testable)

- `?seed=42` — fixes the AI fleet; same fleet on every reload. Use two reloads and
  compare the set of enemy cells to prove determinism.
- `?debug=1` — shows a yellow banner and reveals the AI fleet (enemy cells get
  `aria-label` ending in `, your ship`). Combine: `?seed=42&debug=1`.
- Beware Chrome URL autocomplete: typing `localhost:5173/?seed=42` can autocomplete
  to a previously visited `...&debug=1`. Press `Delete` after typing, before `Enter`.
- The debug banner shifts everything down ~30px, so button/cell screen coordinates
  differ between `?debug=1` and plain URLs. Re-screenshot after changing the URL.

## Reading state without a debugger

Enemy/own cells are `<button aria-label="Enemy waters B7, not yet fired at">`.
Cheap assertions from the console:

- fleet layout: filter enemy buttons whose label contains `your ship`
- leakage check (debug OFF): no enemy label/attribute may mention a ship; enemy cells
  should all have class `cell unknown`. Note `window.app` exists but is only the
  auto-global for `<div id="app">`, not game state — check `instanceof Element` before
  calling it a leak.

## Known traps / possible bugs to re-check

- **Click-to-place may stop working** if a hover handler re-renders the whole page: the
  cell shows the green preview but the button is destroyed between mousedown and mouseup,
  so no click ever fires. This was a real regression once (fixed by `paintPreview()`
  toggling classes instead of re-rendering). If placement clicks do nothing, suspect a
  `mouseenter` → `render()` path first. Workarounds to keep testing: "Random placement"
  or keyboard placement.
- **Keyboard focus can be lost on every re-render** for the same reason. Arrow keys/`R`/
  Enter only work while a grid button has DOM focus. The current fix restores focus after
  render via `data-focus-target` and listens for keydown on `document`. Always re-check:
  arrows after a place, arrows after `R`, and arrows after moving the mouse over the board.
- Verify with `document.activeElement` whenever a key press "does nothing".
- When Enter/Space are intercepted globally for the grid, re-check that Enter on ordinary
  buttons (especially **Play again**) does only that action and does not also fire a shot.

## Fairness / "is the AI cheating?" testing

- Strongest cheap test: hand-place the whole fleet into one corner region (e.g. all 17
  cells in rows 9–10) with `?debug=1`, then log the AI's first ~10 shots. An honest AI
  misses nearly all of them and spreads across the board.
- `npm run selfplay` (1000 games/difficulty, ~1 min) prints averages; Easy ≈95, Normal
  ≈52. A Normal average below ~35 means position leakage.
- With a fixed `?seed=N`, consecutive games after "Play again" legitimately reproduce the
  _same_ AI opening sequence — that is evidence of a full reset, not of retained memory.

## Clipboard (Copy log)

Requires `xclip`: `sudo apt-get install -y xclip`, then read with
`xclip -o -selection clipboard`. Expect `Battleship transcript — seed <n>` followed by
the numbered shot list matching the on-screen log.

## Mobile / narrow width

Chrome refuses windows narrower than ~500 CSS px, so `xdotool getactivewindow windowsize`
cannot reach 390px. Get as narrow as allowed and additionally `ctrl+plus` to shrink the
effective CSS viewport. Assert `document.documentElement.scrollWidth <= clientWidth`
(no horizontal overflow) and check cell `getBoundingClientRect()` is >= 24px.

## Acceptance criteria

SPEC.md Section 10 is a 16-item manual script and Section 11 requires a per-requirement
acceptance table over Sections 4/5/6/8. Read them before planning; item 13 (three complete
games back-to-back) is the one the owner cares most about and must not be shortened.

## Devin Secrets Needed

None — the app is fully local and unauthenticated.
