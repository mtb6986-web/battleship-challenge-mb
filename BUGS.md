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
