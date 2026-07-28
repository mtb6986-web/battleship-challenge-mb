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

- **Click-to-place may not work.** Clicking a cell during placement can show the green
  preview but never place the ship (observed on `devin/1785207000-battleship-vs-ai`).
  Workarounds for continuing the test: the "Random placement" button, or keyboard
  placement.
- **Keyboard focus can be lost on every re-render.** Arrow keys/`R`/Enter only work while
  a grid button has DOM focus; after a render (place, rotate) focus can fall to `BODY`
  and the keys silently stop working. Press `Tab` ~7 times to land back on the first
  grid cell. Also park the mouse pointer OFF the board — hover re-renders can steal focus.
- Verify with `document.activeElement` whenever a key press "does nothing".

## Clipboard (Copy log)

Requires `xclip`: `sudo apt-get install -y xclip`, then read with
`xclip -o -selection clipboard`. Expect `Battleship transcript — seed <n>` followed by
the numbered shot list matching the on-screen log.

## Mobile / narrow width

Chrome refuses windows narrower than ~500 CSS px, so `xdotool getactivewindow windowsize`
cannot reach 390px. Get as narrow as allowed and additionally `ctrl+plus` to shrink the
effective CSS viewport. Assert `document.documentElement.scrollWidth <= clientWidth`
(no horizontal overflow) and check cell `getBoundingClientRect()` is >= 24px.

## Devin Secrets Needed

None — the app is fully local and unauthenticated.
