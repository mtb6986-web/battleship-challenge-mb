# SPEC — Battleship vs. AI

Decisions recorded here are settled. Do not reinterpret them. To change one, ask
first.

> **Revision note.** This spec is the project brief with nine corrections applied
> after the assumptions in the original draft were tested empirically. Each change
> is marked `[REV]` with the reason. The original reasoning is preserved wherever
> it survived testing.

---

## 4. Game rules

- 10×10 grid per side. Columns labeled A–J, rows 1–10.
- Fleet, both sides identical: Carrier 5, Battleship 4, Cruiser 3,
  Submarine 3, Destroyer 2. **Total 17 cells.**
- Ships are horizontal or vertical only. Never diagonal.
- Ships must sit entirely on the board. **A ship must never wrap from the right
  edge onto the next row.** Validate against row and column bounds separately,
  not against a flat array index.
- Ships may not overlap.
- **Ships MAY touch each other**, including corner-to-corner. Adjacency is legal.
- **The human player always fires first.** No coin flip.
- Players alternate exactly one shot each. **A hit does NOT grant another shot.**
- A cell may only be fired at once. Re-firing is blocked, and a blocked click
  does not consume the turn.
- A ship is sunk when every one of its cells has been hit.
- When a ship sinks, announce it **by name**: "You sank my Cruiser."
- The game ends **immediately** when the 17th cell of one fleet is hit. The
  losing side does not get a retaliatory final shot. There is exactly one winner
  and no possibility of a draw.
- After the game ends, no further shots can be fired by either side.

---

## 5. Player experience

**Placement phase**

- Click to place each of the five ships on the player's own board.
- A rotate control, and the `R` key, to flip a ship between horizontal and
  vertical. Rotating near an edge must either be refused cleanly or nudge the
  ship fully on-board. It must never leave the ship in a broken state.
- A "Random placement" button that places all five legally.
- A "Reset placement" button.
- The battle cannot start until all five ships are legally placed.
- Show which ships are still waiting to be placed.

**Battle phase**

- Two boards visible: the player's with their ships and the AI's shots on them;
  the AI's with only the player's shot results — hit, miss, or unknown.
- Click an enemy cell to fire. Cells already fired at are visibly marked and not
  clickable.
- Clear hit / miss / sunk feedback.
- A running shot log for both sides, in text, e.g. "You fired B7 — miss."
- **`[REV 5]` The shot log is copy-pasteable and carries the seed.** A "Copy log"
  control emits the seed plus the full ordered shot list.
  _Reason: a seed alone does not reproduce a live game, because the AI reacts to
  the human's clicks, which differ every run. Seed + shot list does._
- A fleet status panel for both sides showing which ships remain afloat.
- **While the AI is taking its turn, human clicks must be ignored entirely.** It
  must be impossible to fire twice by clicking fast. Block input, don't just hope.
- A difficulty selector: **Easy** and **Normal** (defined in Section 6).

**End of game**

- A clear result screen: who won, and in how many shots.
- A "Play again" button that returns to a completely fresh placement phase.
  **Everything resets** — boards, shot logs, fleet status, win state, and every
  piece of the AI's internal memory including its target queue, its unresolved-hit
  list, and its record of cells already fired at. The second game must behave
  exactly like the first.

**`[REV 8]` Reload behaviour.** Reloading the page mid-game intentionally returns
to a fresh placement phase. There is no saved-game state, because local storage is
out of scope (Section 9). This is correct behaviour, not a bug.
_Reason: test item 14 ("lands somewhere sane") would otherwise read as a request
for persistence, which Section 9 forbids._

**`[REV 4]` Fairness requirement (reworded).**
The AI's ship positions must not be **discoverable by casual inspection**: not in
the HTML, not in element attributes, not on `window` or any other global reachable
from the browser console. State lives in module-private scope.

This is deliberately not an absolute guarantee. The game is a static page with no
backend (Section 2), so the AI's board necessarily exists in the browser's memory
on the player's own machine; anyone willing to set a breakpoint in a debugger can
read it. **True concealment requires a server, which is deliberately out of scope.**
The `?debug=1` reveal toggle (Section 7) exists precisely because the data is
present and can be rendered on demand.
_Reason: the original wording promised something a backendless architecture cannot
deliver, and contradicted the `?debug=1` requirement in the same brief._

---

## 6. AI opponent

**Easy:** fires uniformly at random among cells it has not yet fired at. No
targeting behaviour. It must never repeat a cell and must never hang.

**Normal:** classic hunt / target.

_Hunt mode._ Fire at random among un-fired cells where `(row + column)` is odd.
This "parity" trick works because the smallest ship is 2 cells long, so it must
cover at least one such cell — it halves the search space with no loss.
**Fallback:** if no odd-parity un-fired cells remain, fall back to any un-fired
cell. Do not crash, and do not loop forever looking for a cell that isn't there.

_Target mode._ On a hit, queue that cell's four orthogonal neighbours — filtered
to on-board cells not already fired at. Fire from that queue. Once two hits are
confirmed in a line, work out the axis and extend along it in both directions
until the ship sinks, ignoring the perpendicular neighbours.

**`[REV 3]` Sink handling — the AI tracks unresolved hits.**
The AI maintains a list of **unresolved hits**: cells it has hit that are not yet
accounted for by a sunk ship. When a ship sinks:

1. Remove that ship's cells from the unresolved-hit list.
2. If any unresolved hits remain, stay in target mode and keep working them.
3. Only when the unresolved-hit list is empty may the queue be cleared and hunt
   mode resumed.

_Reason: the original instruction was "clear any queued targets that belonged to
it", which is not knowable — ships may touch, so a queued cell may belong to a
different, still-floating ship. Measured over 1,000 games, blindly clearing the
queue on a sink costs ~3 extra shots per game (55.1 vs 51.9). It fails silently:
nothing crashes, no test goes red, and the degraded result still falls inside the
acceptance band._

**`[REV 6]` Known and accepted limitation.** Because ships may touch, two adjacent
hits can belong to two different ships, so the axis lock can extend along a line
that is not a single ship. The AI self-corrects on the next miss. This is accepted
behaviour, not a defect.

_What Normal is allowed to know:_ the fleet composition (five ships, those
lengths) and its own shot history. **Nothing else.** It must never read the human's
ship positions, at any difficulty, for any reason, including "just to check."

---

## 7. Self-play harness

A script runnable with `npm run selfplay` plays each AI against a randomly-placed
fleet 1,000 times with no UI and prints a table:

| Metric                                                         | Expected                    |
| -------------------------------------------------------------- | --------------------------- |
| Games completed                                                | exactly 1000                |
| Crashes, hangs, or unfinished games                            | 0                           |
| Games exceeding 100 shots                                      | 0                           |
| Games where the loser's hit count ≠ 17                         | 0                           |
| Illegal shots (repeat or off-board)                            | 0                           |
| Illegal fleets generated (overlap / off-board / wrong lengths) | 0                           |
| Average shots to win — **Easy**                                | roughly 90–100              |
| Average shots to win — **Normal**                              | **`[REV 1]` roughly 45–65** |
| Fastest win, slowest win — Normal                              | report both                 |

`[REV 1]` _Reason: a reference implementation of exactly this algorithm measures
51.9, which sits on the bottom edge of the original 50–70 band. A marginally better
implementation would fall outside it and trigger a false alarm. The band needs
headroom in the direction the algorithm actually varies._

Report the actual numbers, not a pass/fail.

**How the average is interpreted, and why it must not be tuned to:**
Pure random guessing needs about 95 shots. A cheater who can see the ships needs
exactly 17. So:

- Normal averaging above ~85 → the targeting logic isn't actually working.
- Normal averaging below ~35 → **the AI is cheating.** Something is reading the
  opponent's ship positions. This is a critical bug, not a nice surprise.

If the number comes out below 35, do not adjust the number. Find what is leaking
the ship positions and report it.

**`[REV 2]` These thresholds apply to the 1,000-game average only — never to a
single game.** In 1,000 measured honest games the fastest legitimate win was **21
shots**. A single fast game is luck and is not evidence of cheating.
_Reason: without this, one lucky live game reads as a critical bug._

**Seeding.** A `seed` option on the harness and on the game (`?seed=42` in the URL)
makes the same seed produce identical ship placement and an identical random-number
stream. Combined with the copy-pasteable shot log (`[REV 5]`), this makes live bug
reports reproducible.

**`[REV 7]` Note on the "over 100 shots" metric.** The board has 100 cells and
repeat fire is already forbidden, so exceeding 100 shots is arithmetically
impossible unless the repeat-fire rule is broken. The metric is retained as an
alarm on that rule, not as a measure of AI quality.

**Reveal toggle.** `?debug=1` displays the AI's board, so specific situations can be
set up deliberately and the AI watched for peeking. Both the seed and debug flags
stay in the shipped build and are documented in the README.

---

## 8. Architecture and testing

- All game logic lives in `src/game/` with **zero references to the DOM, `window`,
  or `document`.** It must be runnable in a plain script. This is what makes the
  self-play harness possible.
- The UI layer only renders state and dispatches actions. No rules live in it.
- Randomness goes through a single seedable generator. No bare `Math.random()`
  scattered through the code, or seeded reproducibility won't work.
- Vitest unit tests covering, at minimum: placement validation including the
  edge-wrap case, overlap rejection, shot resolution, sink detection including a
  ship whose final cell is on a board edge, win detection, full state reset, and
  AI target selection never repeating or going off-board.
- Every bug reported gets a **failing test written first**, then the fix, then the
  test stays in the suite permanently.
- `node_modules` and `dist` are gitignored. A fresh clone must install, test, and
  run with no extra steps, documented in the README.

**`[REV 9]` Automated enforcement.**

- **CI** (continuous integration — a robot that runs checks on every proposed
  change): a GitHub Actions workflow runs typecheck, lint, and the full test suite
  on every push and pull request.
  _Reason: without it, every rule in `AGENTS.md` is honour-system._
- **ESLint + Prettier** are configured and enforced in CI.
  _Reason: prevents style drift making later changes noisy and hard to review._

**`[REV 9]` Accessibility — made concrete and therefore verifiable.**
"Keyboard navigable" is replaced by:

- Arrow keys move a focus cursor between cells on the active board.
- `Enter` or `Space` fires at (or places on) the focused cell.
- `R` rotates the ship being placed.
- Every cell has an accessible label naming its coordinate and state.
- Shot results are announced through an ARIA live region for screen readers.
- Visible focus indicator on the focused cell.
- Usable on a phone-width screen with touch.

_Reason: the original wording could not be marked done or not-done by anyone._

---

## 9. NOT IN SCOPE — do not build any of this

Sound effects. Animations beyond simple hit/miss feedback. Saved or resumable
games. Local storage. User accounts or login. Multiplayer or networking. A
leaderboard. Analytics or telemetry. A backend or server of any kind. Themes or
skins. AI difficulty levels beyond the two specified. Ship damage graphics. An
in-game tutorial or onboarding flow.

If something here seems essential, ask. Do not add it. Every extra feature is
another place this can break, and none of it is being graded.

---

## 10. Manual test script — run before every handoff

Walk through all of it in a browser and report the results line by line. Anything
that cannot be verified is marked UNVERIFIED with the reason. A false PASS is
worse than an honest UNVERIFIED.

1. Loads on a phone-width screen. Board readable and tappable.
2. Place all five ships successfully.
3. Ship hanging off the right edge → refused, and does **not** wrap onto the next row.
4. Ship overlapping another → refused.
5. Two ships touching each other → allowed.
6. Rotate a ship sitting against an edge → clean refusal or clean nudge, never a broken state.
7. "Random placement" twenty times rapidly → no crash, no freeze, five legal ships every time.
8. Fire once, then click the same cell again → refused, turn not consumed.
9. During the AI's turn, click three cells rapidly → no extra shot.
10. Sink one enemy ship → announced by name, marked sunk in the fleet panel.
11. Sink a ship whose last remaining cell is on the outer edge → sink detection still fires.
12. Play through to a win, then to a loss. Both end screens correct.
13. **Click "Play again" and play a complete second game.** Shot logs empty, all
    ships restored, and the AI hunts from scratch rather than continuing near where
    it left off. Then do it a **third** time.
14. Reload mid-game → lands somewhere sane. [REV 8] A fresh placement phase is the
    intended destination, not a bug.
15. Load with `?debug=1` and play → the AI's shots do not walk straight onto the
    player's ships. Early shots look like a genuine search.
16. Inspect the enemy board in developer tools before firing → ship positions are
    not visible. [REV 4] This covers casual inspection only; see Section 5.

Item 13 is the one most likely to reveal a real bug. Do not skip or shorten it.

## 11. Acceptance report — required before claiming completion

One row per requirement in Sections 4, 5, 6 and 8:

| Requirement | PASS / FAIL / NOT DONE / UNVERIFIED | File & line | How it was verified |

- **Nothing gets PASS on the basis of reading the code.** Only on running it.
- Anything not run is UNVERIFIED. That is an acceptable answer; a false PASS is not.
- Append the full self-play statistics from Section 7.
- List anything built that is not in this specification, and why.
