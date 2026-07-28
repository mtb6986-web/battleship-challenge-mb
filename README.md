# Battleship vs. AI

Single-player Battleship against a hunt-and-target AI opponent. A static web page:
no backend, no database, no network calls at runtime.

## Play

```bash
npm install
npm run dev
```

Then open the address it prints (usually <http://localhost:5173>).

Place five ships, press **Start battle**, and click a cell in _Enemy waters_ to fire.
You always shoot first. A hit does not earn a second shot.

## Run the checks

```bash
npm test        # unit tests
npm run lint    # linting
npm run typecheck
npm run build   # production build into dist/
```

A fresh clone needs nothing beyond `npm install`.

## Prove the AI works

```bash
npm run selfplay
```

Plays 1,000 games per difficulty with no browser involved and prints a table.

The numbers to read: **pure random guessing needs about 95 shots. An AI that could
see your ships would need exactly 17.** Where the average lands between those two
poles tells you whether the AI is working and whether it is honest.

|        | Expected | Typical measured |
| ------ | -------- | ---------------- |
| Easy   | 90–100   | 95.3             |
| Normal | 45–65    | 51.7             |

- Above ~85 on Normal → the targeting logic is not working.
- Below ~35 on Normal → the AI is reading the ship positions. That is a critical bug.

**Both thresholds apply to the 1,000-game average, never to a single game.** The
fastest legitimate single game observed was 26 shots; short games are luck.

Options:

```bash
npm run selfplay -- --games 5000 --seed 7
```

## URL flags

Both stay in the shipped build.

| Flag       | Effect                                                  |
| ---------- | ------------------------------------------------------- |
| `?seed=42` | Fixes ship placement and the random-number stream.      |
| `?debug=1` | Reveals the AI's fleet, to watch whether it is peeking. |

Combine them: `?seed=42&debug=1`.

**A seed alone does not reproduce a game.** The AI reacts to your clicks, which
differ every time you play. To file a reproducible bug report, use the **Copy log**
button — it copies the seed together with the full ordered shot list.

## Controls

| Input         | Action                            |
| ------------- | --------------------------------- |
| Click         | Place a ship, or fire             |
| Arrow keys    | Move the focus cursor             |
| Enter / Space | Place or fire at the focused cell |
| `R`           | Rotate the ship being placed      |

Cells carry accessible labels naming their coordinate and state, and results are
announced through a live region for screen readers.

## How it is put together

```
src/game/    all the rules. No DOM, no window, no document.
src/ui/      renders a snapshot and dispatches actions. No rules.
scripts/     the self-play harness entry point.
tests/       Vitest unit tests.
```

The separation is the point. Because the rules do not know a screen exists, the
same code can play 1,000 games in a couple of seconds with no browser — which is
what makes the statistical proof above possible. A lint rule enforces it: `src/game`
may not reference `window`, `document`, `navigator`, or `Math.random`.

All randomness goes through one seedable generator (`src/game/rng.ts`), so seeded
runs are reproducible.

### On the AI not cheating

The AI receives only the fleet composition and its own shot history. It is never
passed the player's ship positions.

Its own fleet is held in module-private state and is never written into the HTML,
into element attributes, or onto any global object, so it is not discoverable by
casual inspection.

This is deliberately not an absolute guarantee. With no backend, the AI's board
necessarily exists in the browser's memory on the player's own machine, and anyone
willing to set a breakpoint can read it. Genuinely concealing it would require a
server, which is out of scope. See `SPEC.md` Section 5.

## Project documents

| File            | Contents                                                            |
| --------------- | ------------------------------------------------------------------- |
| `SPEC.md`       | Settled decisions. Changing one requires asking first.              |
| `AGENTS.md`     | Working rules for anyone, human or AI, touching this repo.          |
| `SAVEPOINTS.md` | Known-good commits with plain-English labels.                       |
| `BUGS.md`       | Every bug found, with root cause and its permanent regression test. |

## Deploying

The build output is a folder of static files, so any static host works.

```bash
npm run build   # writes dist/
```

For **GitHub Pages**, the site is served from `/<repo-name>/` rather than the domain
root, so the base path must be set or the page renders blank white:

```bash
VITE_BASE=/battleship/ npm run build
```

For **Netlify** or similar root-served hosts, no base path is needed.

Always verify the live URL, not just the build log.
