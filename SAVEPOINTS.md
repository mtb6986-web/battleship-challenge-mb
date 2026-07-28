# Save points

Every confirmed-working state, newest last. Use these to go backwards rather than
repairing forward through a broken state.

| Commit | Date | What works at this commit |
|---|---|---|
| `ec61e32` | 2026-07-28 | Rules engine, both AI opponents and the self-play harness. No screen yet. 1,000 games per difficulty run clean: Easy 95.3 shots, Normal 51.7, zero crashes or illegal moves. |
| `0cebb5b` | 2026-07-28 | Fully playable in a browser: ship placement, battle, shot log, fleet status, difficulty toggle, result screen and Play again. Keyboard and screen-reader support, mobile layout, linting and CI. 69 unit tests pass. |
