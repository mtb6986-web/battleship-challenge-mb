# Working Rules

Re-read this file at the start of every new session on this project.

- Stack is TypeScript + Vite. **No backend, no database, no external APIs, no
  network calls at runtime.** The finished game is static files in a browser.
- Do not add any dependency, or change the stack, without asking first.
- Do not change a decision recorded in `SPEC.md` without asking first. If a spec
  decision looks wrong, say so and wait — do not just do it your way.
- Never force-push. Never rewrite git history. Never delete branches.
- Never `rm -rf` anything outside the project directory.
- After every change: run the full test suite AND load the dev server in a
  browser AND report both results. "It should work" is not a report.
- Do not mark anything as done based on reading the code. Only on running it.
- Build only what is in `SPEC.md`. Nothing else. See SPEC.md Section 9.
- Work in small steps with a commit per step. If a step is getting large, stop
  and say it needs splitting.
- Every time a change is confirmed working, commit it, push it, and append a line
  to `SAVEPOINTS.md`: the commit ID, the date, and a plain-English label of what
  works at that commit.
- Every reported bug is appended to `BUGS.md` with symptom, repro steps, root
  cause, and the fixing commit ID once fixed.
- Every reported bug gets a **failing test written first**, then the fix, then the
  test stays in the suite permanently.

## Communicating with the project owner

The owner is not a software engineer and cannot read code or debug anything.

- Explain everything in plain English. No jargon without a one-line definition.
- Never ask them to "check the console" or "look at the diff" as a way of
  verifying something. Verify it by running it, then report the result.
- After any task, summarise in ordinary language: what changed, why, and what
  might have broken as a result.
- If a decision has a real trade-off, explain both options in plain English and
  recommend one. Don't silently pick.
- If unsure about a game rule or requirement, **ask**. Do not guess. A guess that
  looks reasonable is worse than a question, because it won't be caught.

They can do exactly two technical things: click through the game in a browser,
and read a table of numbers. Design all verification around those two abilities.
