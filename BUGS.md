# Bugs

Every reported bug, with a permanent regression test. Newest last.

Format: symptom → repro steps → root cause → fixing commit.

---

## BUG-001 — Normal AI abandoned a wounded ship when a touching ship sank

**Found by:** the self-play harness, not by playing the game. Nothing crashed and
no test went red.

**Symptom.** Normal AI averaged **55.3 shots** instead of the expected ~52, and the
worst game took **100 shots** — meaning it had fired at every cell on the board,
which should be impossible for a working targeting AI.

**Repro.** `npm run selfplay -- --games 1000 --seed 42` and read the Normal table.

**Root cause.** When a ship sank, the AI worked out which cells that ship had
occupied by walking outward from the killing shot through its own record of
unresolved hits. Because ships are allowed to touch, that walk could run straight
through the killing shot and on into a _different, still-floating_ ship that had
also been hit.

The AI then marked those neighbouring hits as "accounted for", found its unresolved
list empty, cleared its target queue, and went back to random hunting — throwing
away a confirmed hit on a live ship. If that abandoned ship happened to sit on
even-parity cells, the AI had to exhaust all 50 odd-parity cells before it could
even look there again. That is the 100-shot game.

This is the exact failure mode the spec warns about in Section 6 `[REV 3]`: it
degrades play silently and the degraded result still sits inside the acceptance
band, so the acceptance check would have passed it.

**Fix.** The reconstruction can now never claim more cells than the sunk ship's
known length. Both axes through the killing shot are considered, the shorter run
that is still long enough to hold the ship is preferred, and the result is trimmed
to a window of exactly the ship's length around the killing shot. Any hits outside
that window belong to a neighbour and stay on the unresolved list, so the AI keeps
hunting them.

**Result.** Average 55.3 → **51.7**. Worst game 100 → **68**.

**Regression tests.** `tests/ai.test.ts`:

- `keeps hunting a touching ship after its neighbour sinks`
- `never claims more cells than the sunk ship's length`

**Fixing commit:** `ec61e32` (found and fixed before the first UI existed).

---

## BUG-002 — Clicking a square did not place a ship, and the keyboard switched itself off

**Found by:** a human playing the game in a browser. Every automated check was
green: 69 unit tests, lint, typecheck and build all passed while the single most
common action in the game did not work.

**Symptom.** Two apparently unrelated faults:

1. On the placement screen, clicking a cell showed the green preview but never
   placed the ship. Random placement and keyboard placement both worked, and
   clicking buttons and firing at the enemy board worked, so it looked specific
   to placement.
2. After placing a ship or pressing `R`, the focus outline vanished and the arrow
   keys, Enter and `R` stopped responding until roughly seven presses of Tab got
   back onto the grid. Moving the mouse over the board did the same thing.

**Repro.** Load the page, move the mouse onto a cell in "Your waters", click.
Nothing is placed.

**Root cause.** One mistake, showing up twice. To draw the green placement preview,
the `mouseenter` handler called `render()`, which rebuilds the entire page.
`mouseenter` fires on every mouse movement onto a cell, so the button the player
was pressing was destroyed and replaced between `mousedown` and `mouseup`. A
browser only reports a click when both halves land on the same element, so no
click was ever reported.

The same rebuild discarded whichever element had keyboard focus, dropping it to
`<body>`. Because the key handler was attached to the app container rather than
the document, keys stopped being heard entirely once focus escaped it.

**Fix.**

- `paintPreview()` re-styles the existing cells with `classList.toggle` instead of
  rebuilding them, so hovering no longer destroys anything.
- `render()` records whether focus was on a grid cell and restores it afterwards.
- The key handler is attached to `document`, so arrow keys and `R` keep working
  even if focus does drift. Enter and Space are only intercepted when focus is
  genuinely on the grid, so ordinary buttons still behave normally.

**Lesson worth keeping.** The whole test suite tests the rules engine, which was
entirely innocent here. Nothing tested the wiring between a mouse and that engine.
Statistical self-play proves the AI is sound; it says nothing about whether a
person can operate the game. Both kinds of check are needed.

**Fixing commit:** `c1ae6ee`.
