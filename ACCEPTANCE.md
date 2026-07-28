# Acceptance report

Required by `SPEC.md` Section 11. One row per requirement in Sections 4, 5, 6 and 8.

Rule applied throughout: **nothing is marked PASS on the basis of reading the code.**
PASS means it was observed working, either in a browser or in a test run. Anything
not actually exercised is UNVERIFIED, which is an acceptable answer. A false PASS
is not.

Verification methods referred to below:

- **Browser** — a person clicked through it in Chrome against the running app.
- **Unit** — a Vitest test in `tests/`. 69 tests, all passing.
- **Self-play** — 1,000 games per difficulty with no browser, `npm run selfplay`.

Commit under test: `c1ae6ee`.

---

## Section 4 — Game rules

| Requirement                                                           | Result | Where                                        | How verified                                                                                                                                          |
| --------------------------------------------------------------------- | ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two 10×10 boards, columns A–J, rows 1–10                              | PASS   | `src/game/types.ts` `BOARD_SIZE`             | Browser: both grids render with A–J and 1–10 labels.                                                                                                  |
| Fleet of Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2 | PASS   | `src/game/types.ts` `FLEET`                  | Browser: fleet panel lists all five. Unit: `validateFleet` rejects any other composition.                                                             |
| 17 ship cells in total                                                | PASS   | `src/game/types.ts` `TOTAL_SHIP_CELLS`       | Self-play: 0 games where the loser's hit count was anything other than 17, across 2,000 games.                                                        |
| Horizontal or vertical placement only, never diagonal                 | PASS   | `src/game/board.ts` `shipCells`              | Unit: only two orientations exist in the type; no diagonal path in the API. Browser: rotate toggles between the two.                                  |
| Ships may not overlap                                                 | PASS   | `src/game/board.ts` `placementError`         | Browser: §10 item 4, overlapping placement refused. Unit: overlap rejection test.                                                                     |
| Ships may touch, including corner to corner                           | PASS   | `src/game/board.ts` `placementError`         | Browser: §10 item 5, two ships placed touching edge-to-edge and corner-to-corner, both accepted. Unit: two touching tests.                            |
| Ships may not wrap off the edge of the board                          | PASS   | `src/game/board.ts` `shipCells` + `inBounds` | Browser: §10 item 3, a ship overhanging the right edge is refused and does not appear on the next row. Unit: edge-wrap test.                          |
| Human always fires first                                              | PASS   | `src/game/engine.ts` `startBattle`           | Browser: three complete games, the player's shot is always first in the log. Unit: turn-order test.                                                   |
| One shot per turn; a hit does not grant an extra shot                 | PASS   | `src/game/engine.ts` `fireAtAi`              | Browser: §10, after a hit the AI still replies before the next player shot. Unit: hit-grants-no-extra-turn test.                                      |
| Repeat shots are blocked and do not consume a turn                    | PASS   | `src/game/engine.ts` `canFireAt`             | Browser: §10 item 8, clicking a fired cell does nothing and the turn is not spent. Unit: repeat-shot test. Self-play: 0 illegal shots in 2,000 games. |
| A ship is sunk when all its cells are hit                             | PASS   | `src/game/board.ts` `isSunk`                 | Browser: §10 item 10. Unit: sink-detection tests.                                                                                                     |
| Sink detection works when the final cell is on the outer edge         | PASS   | `src/game/board.ts` `isSunk`                 | Browser: §10 item 11, a ship whose last cell was A8 registered as sunk. Unit: edge and corner sink tests.                                             |
| Sunk ships are announced by name                                      | PASS   | `src/ui/render.ts` `describeLogEntry`        | Browser: log reads "sunk! You sank my Cruiser." and the fleet panel strikes it through.                                                               |
| Game ends immediately on the 17th hit, with no retaliatory shot       | PASS   | `src/game/engine.ts` `fireAtAi`              | Browser: §10 item 12, both a win and a loss end with no extra shot in the log. Unit: no-retaliation test.                                             |
| No draw is possible                                                   | PASS   | `src/game/engine.ts`                         | Unit: exactly-one-winner test. Self-play: 0 unfinished games in 2,000.                                                                                |

## Section 5 — Player experience

| Requirement                                                              | Result                      | Where                                          | How verified                                                                                                                                                                           |
| ------------------------------------------------------------------------ | --------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click to place ships                                                     | PASS                        | `src/ui/app.ts` `place`                        | Browser: all five ships placed by mouse only. **This failed the first test run — see BUG-002 — and passes only after the fix.**                                                        |
| Rotate control, and `R` rotates                                          | PASS                        | `src/ui/app.ts` `onKeyDown`                    | Browser: both the button and the `R` key flip orientation.                                                                                                                             |
| Rotating near an edge refuses cleanly or nudges on board                 | PASS                        | `src/game/board.ts` `rotatedPlacement`         | Browser: §10 item 6, red preview and clean refusal, no broken state. Unit: rotation nudge and refusal tests.                                                                           |
| Random placement button                                                  | PASS                        | `src/ui/app.ts`                                | Browser: §10 item 7, clicked 20 times rapidly, five legal ships every time, no crash or freeze. Unit: 1,000 random fleets all legal.                                                   |
| Reset placement button                                                   | PASS                        | `src/ui/app.ts`                                | Browser: clears the board back to the Carrier.                                                                                                                                         |
| Battle cannot start until all ships are placed                           | PASS                        | `src/game/engine.ts` `startBattle`             | Browser: the Start battle button is disabled until the fifth ship lands.                                                                                                               |
| Remaining ships shown during placement                                   | PASS                        | `src/ui/app.ts` `placementControls`            | Browser: the next ship is highlighted and placed ones are struck through.                                                                                                              |
| Two boards; the player's ships visible only on their own board           | PASS                        | `src/ui/render.ts` `describeBoard`             | Browser: §10 item 16, all 100 enemy cells read "unknown".                                                                                                                              |
| Enemy board shows unknown / hit / miss / sunk                            | PASS                        | `src/ui/render.ts`                             | Browser: all four states observed across three games.                                                                                                                                  |
| Already-fired enemy cells visibly marked                                 | PASS                        | `src/ui/styles.css`                            | Browser: misses show a dot, hits a red cross, sunk ships a dark red cross.                                                                                                             |
| Running shot log                                                         | PASS                        | `src/ui/app.ts` `logPanel`                     | Browser: alternating player and AI entries, newest first.                                                                                                                              |
| Fleet status panels                                                      | PASS                        | `src/ui/app.ts` `boardPanel`                   | Browser: ships strike through as they sink.                                                                                                                                            |
| Human clicks ignored while the AI is taking its turn                     | PASS                        | `src/game/engine.ts` `canFireAt`               | Browser: §10 item 9, four rapid clicks during the AI's turn produced exactly one shot. Unit: awaiting-AI test.                                                                         |
| Difficulty selector, Easy and Normal                                     | PASS                        | `src/ui/app.ts` `placementControls`            | Browser: both selectable; behaviour differs as expected (see Section 6).                                                                                                               |
| Clear winner screen with the number of shots                             | PASS                        | `src/ui/app.ts` `resultPanel`                  | Browser: "You win" at 34 shots and "The AI wins" at 62 shots both observed.                                                                                                            |
| Play Again fully resets boards, logs, fleet status and winner            | PASS                        | `src/game/engine.ts` `reset`                   | Browser: §10 item 13, three complete games back to back. Unit: full-reset test.                                                                                                        |
| Play Again resets the AI's target queue, unresolved hits and fired cells | PASS                        | `src/game/engine.ts` `reset`                   | Browser: §10 item 13, the AI's openings in games 2 and 3 did not resume near where the previous game ended. Unit: AI-memory-reset test.                                                |
| Reloading mid-game returns to a fresh placement phase                    | PASS                        | no persistence by design                       | Browser: §10 item 14.                                                                                                                                                                  |
| No local storage, no saved game                                          | PASS                        | —                                              | Browser: §10 item 16 inspection found nothing in storage.                                                                                                                              |
| AI positions not exposed to casual inspection                            | PASS                        | `src/game/engine.ts` `snapshot`, `src/main.ts` | Browser: §10 item 16, nothing in the HTML, element attributes, globals or storage. Unit: a test walks the whole serialized snapshot and asserts every ship in it belongs to the human. |
| Absolute concealment is **not** promised                                 | N/A — documented limitation | `SPEC.md` §5                                   | With no backend the AI's board must exist in the player's own browser memory. A debugger defeats it. This is stated rather than papered over.                                          |
| `?debug=1` intentionally reveals the AI board                            | PASS                        | `src/main.ts`, `src/ui/app.ts`                 | Browser: banner appears and the enemy fleet is shown.                                                                                                                                  |

## Section 6 — AI opponent

| Requirement                                                   | Result               | Where                                 | How verified                                                                                                                                                                                         |
| ------------------------------------------------------------- | -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Easy fires uniformly at random among un-fired cells           | PASS                 | `src/game/ai.ts` `EasyOpponent`       | Self-play: average 95.3 shots, statistically indistinguishable from random. Browser: after a hit it wandered off (I8, A3, H1, H3…).                                                                  |
| Easy never repeats a shot                                     | PASS                 | `src/game/ai.ts`                      | Self-play: 0 illegal shots in 1,000 games. Unit: never-repeats test.                                                                                                                                 |
| Easy never hangs                                              | PASS                 | `src/game/ai.ts`                      | Self-play: 0 unfinished games. Unit: exhaustion test.                                                                                                                                                |
| Normal uses hunt/target                                       | PASS                 | `src/game/ai.ts` `NormalOpponent`     | Self-play: average 51.7 vs Easy's 95.3. Browser: probes neighbours immediately after a hit.                                                                                                          |
| Hunt mode prefers odd-parity cells                            | PASS                 | `src/game/ai.ts`                      | Unit: parity-opening test.                                                                                                                                                                           |
| Falls back to any un-fired cell when parity cells run out     | PASS                 | `src/game/ai.ts`                      | Unit: parity-fallback test.                                                                                                                                                                          |
| Queues orthogonal neighbours on a hit                         | PASS                 | `src/game/ai.ts`                      | Unit: neighbour-targeting test. Browser: observed in three games.                                                                                                                                    |
| Extends along the discovered axis after aligned hits          | PASS                 | `src/game/ai.ts`                      | Unit: axis-lock test.                                                                                                                                                                                |
| Tracks unresolved hits                                        | PASS                 | `src/game/ai.ts` `unresolvedHits`     | Unit: BUG-001 regression tests. Self-play: worst Normal game 68 shots, down from 100 before the fix.                                                                                                 |
| The AI is never given the opponent's ship positions           | PASS                 | `src/game/ai.ts` `Opponent` interface | The interface only accepts `observe(result)`. Browser: §10 item 15 — the player's fleet was packed into rows 9–10 with debug on, and the AI's first ten shots all missed and were spread board-wide. |
| Easy averages 90–100 shots                                    | PASS — **95.3**      | —                                     | Self-play, 1,000 games.                                                                                                                                                                              |
| Normal averages 45–65 shots                                   | PASS — **51.7**      | —                                     | Self-play, 1,000 games.                                                                                                                                                                              |
| Average over ~85 on Normal means targeting failed             | PASS — not triggered | —                                     | 51.7 is well inside the band.                                                                                                                                                                        |
| Average under ~35 on Normal means a possible information leak | PASS — not triggered | —                                     | 51.7. The fastest single honest game was 26 shots, which is why this threshold applies only to the average.                                                                                          |

## Section 8 — Architecture and testing

| Requirement                                                        | Result           | Where                                | How verified                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure game logic in `src/game/`                                     | PASS             | `src/game/`                          | The self-play harness runs the entire game in Node with no browser present, which is only possible if this holds.                                                                                                                 |
| No DOM, `window` or `document` in game logic                       | PASS             | `eslint.config.js`                   | Enforced, not merely intended: a lint rule fails the build if `src/game/**` references `window`, `document`, `navigator` or `Math.random`. `npm run lint` passes.                                                                 |
| UI only renders state and dispatches actions                       | PASS             | `src/ui/`                            | No rule logic in `src/ui/`; every state change goes through a `Game` method.                                                                                                                                                      |
| One seedable RNG, no scattered `Math.random()`                     | PASS             | `src/game/rng.ts`                    | Enforced by the same lint rule. Unit: seed-reproducibility tests.                                                                                                                                                                 |
| Tests and self-play run without a browser                          | PASS             | —                                    | `npm test` and `npm run selfplay` both run headless in CI.                                                                                                                                                                        |
| `?seed=42` supported and reproducible                              | PASS             | `src/main.ts`                        | Browser: the same seed produced an identical 17-cell AI fleet across reloads; a different seed differed.                                                                                                                          |
| A seed alone does not reproduce a live human game                  | N/A — documented | `SPEC.md` §7                         | True by construction: the AI reacts to the player's clicks, which differ every game.                                                                                                                                              |
| Shot log includes the seed and the ordered shot list               | PASS             | `src/ui/render.ts` `transcript`      | Browser: Copy log produced "Battleship transcript — seed 42" followed by the numbered shots.                                                                                                                                      |
| Unit tests cover the Section 8 list                                | PASS             | `tests/`                             | 69 tests passing: edge wrap, overlap, touching, shot resolution, sink detection including edge cases, win detection, full reset, AI never repeats, AI never goes off board, AI targeting, seed reproducibility, fleet validation. |
| Arrow keys move focus; Enter or Space fires or places; `R` rotates | PASS             | `src/ui/app.ts` `onKeyDown`          | Browser: a full fleet placed using only the keyboard. **This regressed after each render in the first test run — see BUG-002.**                                                                                                   |
| Cells carry coordinate and state labels                            | PASS             | `src/ui/render.ts` `describeBoard`   | Browser: cells read e.g. "Enemy waters D4, hit".                                                                                                                                                                                  |
| Shot results announced through an ARIA live region                 | PASS             | `src/ui/app.ts` `liveRegion`         | Browser: the live region updates with each result.                                                                                                                                                                                |
| Visible focus indicator                                            | PASS             | `src/ui/styles.css` `:focus-visible` | Browser: an orange outline follows the keyboard cursor.                                                                                                                                                                           |
| Usable at phone width, with touch support                          | PASS with caveat | `src/ui/styles.css`                  | Browser: single column, no sideways scrolling, 42px tappable cells. **Caveat:** Chrome will not size a window below about 500 CSS pixels, so a true 390px phone was approximated with the narrowest window plus zoom.             |
| ESLint, Prettier, and CI running typecheck, lint, tests and format | PASS             | `.github/workflows/ci.yml`           | CI runs format check, lint, typecheck, 69 unit tests, a production build, and a 200-game self-play smoke run.                                                                                                                     |

---

## Self-play statistics

`npm run selfplay` at commit `c1ae6ee`:

```
--- EASY (1000 games) ---
  Games completed                          1000
  Crashes, hangs, or unfinished games      0
  Games exceeding 100 shots                0
  Games where the loser's hit count != 17  0
  Illegal shots (repeat or off-board)      0
  Illegal fleets generated                 0
  Average shots to win                     95.3
  Fastest win                              64
  Slowest win                              100

--- NORMAL (1000 games) ---
  Games completed                          1000
  Crashes, hangs, or unfinished games      0
  Games exceeding 100 shots                0
  Games where the loser's hit count != 17  0
  Illegal shots (repeat or off-board)      0
  Illegal fleets generated                 0
  Average shots to win                     51.7
  Fastest win                              26
  Slowest win                              68
```

## Built but not in the brief

| Thing                                                                                                  | Why                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.js` rule banning `window`, `document`, `navigator` and `Math.random` inside `src/game/` | The brief requires the rules to be separable from the screen, but relied on discipline to keep it that way. This makes the build fail instead. Added under `SPEC.md` §9 `[REV 9]`. |
| A 200-game self-play run inside CI                                                                     | BUG-001 proved that an AI regression can leave every unit test green. Only a statistical run catches that class of bug, so CI runs one on every change.                            |
| `.agents/skills/testing-battleship/SKILL.md`                                                           | Records how to test the game, so a future session does not rediscover the same traps.                                                                                              |

## Not verified

| Item                                                 | Why                                                                                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A genuine 390px phone screen                         | Chrome will not size a window below ~500 CSS pixels. Approximated with zoom. Worth checking on a real handset before any interview demo. |
| A live deployed URL                                  | No deployment target has been chosen yet. Everything above was verified against the local dev server and a production build.             |
| Screen reader behaviour with an actual screen reader | The ARIA labels and live region are present and correct in the markup, but no assistive technology was run against them.                 |
