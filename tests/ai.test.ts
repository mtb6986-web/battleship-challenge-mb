import { describe, expect, it } from 'vitest';
import { EasyOpponent, NormalOpponent, createOpponent } from '../src/game/ai';
import { coordKey, inBounds, randomFleet, resolveShot } from '../src/game/board';
import { Rng } from '../src/game/rng';
import { TOTAL_SHIP_CELLS } from '../src/game/types';
import type { Coord, ShipName, ShotResult } from '../src/game/types';

const shot = (
  row: number,
  col: number,
  outcome: ShotResult['outcome'],
  sunkShip: ShipName | null = null,
): ShotResult => ({
  coord: { row, col },
  outcome,
  sunkShip,
  fleetDestroyed: false,
});

describe('every opponent obeys the basic shot rules', () => {
  for (const difficulty of ['easy', 'normal'] as const) {
    it(`${difficulty}: never repeats a cell and never goes off-board, over a full board`, () => {
      const opponent = createOpponent(difficulty, new Rng(3));
      const seen = new Set<string>();

      for (let i = 0; i < 100; i += 1) {
        const coord = opponent.nextShot();
        expect(inBounds(coord)).toBe(true);
        expect(seen.has(coordKey(coord))).toBe(false);
        seen.add(coordKey(coord));
        opponent.observe(shot(coord.row, coord.col, 'miss'));
      }
      expect(seen.size).toBe(100);
    });

    it(`${difficulty}: throws rather than hanging once the board is exhausted`, () => {
      const opponent = createOpponent(difficulty, new Rng(4));
      for (let i = 0; i < 100; i += 1) opponent.nextShot();
      expect(() => opponent.nextShot()).toThrow();
    });

    it(`${difficulty}: is reproducible for a given seed`, () => {
      const shotsFor = () => {
        const opponent = createOpponent(difficulty, new Rng(11));
        return Array.from({ length: 30 }, () => coordKey(opponent.nextShot()));
      };
      expect(shotsFor()).toEqual(shotsFor());
    });
  }
});

describe('Easy opponent', () => {
  it('does not chase a hit', () => {
    const opponent = new EasyOpponent(new Rng(5));
    const first = opponent.nextShot();
    opponent.observe(shot(first.row, first.col, 'hit'));

    // Over many seeds an untargeted AI lands next to its hit only occasionally.
    let adjacent = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const ai = new EasyOpponent(new Rng(seed));
      const a = ai.nextShot();
      ai.observe(shot(a.row, a.col, 'hit'));
      const b = ai.nextShot();
      if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1) adjacent += 1;
    }
    expect(adjacent).toBeLessThan(40);
  });
});

describe('Normal opponent hunt mode', () => {
  it('opens on an odd-parity cell', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const coord = new NormalOpponent(new Rng(seed)).nextShot();
      expect((coord.row + coord.col) % 2).toBe(1);
    }
  });

  it('falls back to even-parity cells once the odd ones are gone', () => {
    const opponent = new NormalOpponent(new Rng(6));
    for (let i = 0; i < 50; i += 1) {
      const coord = opponent.nextShot();
      expect((coord.row + coord.col) % 2).toBe(1);
      opponent.observe(shot(coord.row, coord.col, 'miss'));
    }
    const next = opponent.nextShot();
    expect((next.row + next.col) % 2).toBe(0);
  });
});

describe('Normal opponent target mode', () => {
  it('fires at a neighbour of its hit', () => {
    const opponent = new NormalOpponent(new Rng(8));
    const first = opponent.nextShot();
    opponent.observe(shot(first.row, first.col, 'hit'));

    const second = opponent.nextShot();
    expect(Math.abs(first.row - second.row) + Math.abs(first.col - second.col)).toBe(1);
  });

  it('locks onto the axis once two hits line up', () => {
    const opponent = new NormalOpponent(new Rng(9));
    // Force two known in-line hits without letting the AI see any ship positions.
    opponent.observe(shot(4, 4, 'hit'));
    opponent.observe(shot(4, 5, 'hit'));

    const next = opponent.nextShot();
    expect(next.row).toBe(4);
    expect([3, 6]).toContain(next.col);
  });

  it('returns to hunting after the only wounded ship sinks', () => {
    const opponent = new NormalOpponent(new Rng(10));
    opponent.observe(shot(4, 4, 'hit'));
    opponent.observe(shot(4, 5, 'sunk', 'Destroyer'));

    const next = opponent.nextShot();
    const adjacentToSunk = Math.abs(next.row - 4) + Math.min(Math.abs(next.col - 4), Math.abs(next.col - 5));
    expect(adjacentToSunk === 0).toBe(false);
  });
});

// Regression tests for BUG-001. See BUGS.md.
describe('BUG-001: sink attribution with touching ships', () => {
  it('keeps hunting a touching ship after its neighbour sinks', () => {
    const opponent = new NormalOpponent(new Rng(12));

    // Three hits in a row, but only a two-cell Destroyer went down, so one of the
    // outer hits still belongs to a live, touching ship.
    opponent.observe(shot(4, 4, 'hit'));
    opponent.observe(shot(4, 6, 'hit'));
    opponent.observe(shot(4, 5, 'sunk', 'Destroyer'));

    const isNeighbourOfAHit = (c: Coord) =>
      [
        { row: 4, col: 4 },
        { row: 4, col: 6 },
      ].some((hit) => Math.abs(c.row - hit.row) + Math.abs(c.col - hit.col) === 1);

    // It must stay in target mode rather than dropping back to a random hunt.
    const next = Array.from({ length: 6 }, () => opponent.nextShot());
    expect(next.slice(0, 4).every(isNeighbourOfAHit)).toBe(true);

    // And specifically, the hit at (4,6) must not have been written off.
    const chasedTheLiveHit = next.some(
      (c) => Math.abs(c.row - 4) + Math.abs(c.col - 6) === 1,
    );
    expect(chasedTheLiveHit).toBe(true);
  });

  it('resolves only the cells it can be certain about', () => {
    const opponent = new NormalOpponent(new Rng(14));

    // Unambiguous: a two-cell run and a two-cell ship. Both cells are accounted
    // for, so the AI has no leads left and must go back to parity hunting.
    opponent.observe(shot(6, 2, 'hit'));
    opponent.observe(shot(6, 3, 'sunk', 'Destroyer'));

    const next = opponent.nextShot();
    expect((next.row + next.col) % 2).toBe(1);
  });

  it("never claims more cells than the sunk ship's length", () => {
    const opponent = new NormalOpponent(new Rng(13));

    // Four in a row, but the ship that sank is only two cells long.
    opponent.observe(shot(2, 2, 'hit'));
    opponent.observe(shot(2, 3, 'hit'));
    opponent.observe(shot(2, 4, 'hit'));
    opponent.observe(shot(2, 5, 'sunk', 'Destroyer'));

    // Two hits remain unresolved and in line, so the AI must still be extending them.
    const next = opponent.nextShot();
    expect(next.row).toBe(2);
    expect([1, 4]).toContain(next.col);
  });
});

describe('the AI cannot be reading the ship positions', () => {
  it('takes far more than 17 shots to clear a fleet', () => {
    let totalShots = 0;
    const runs = 50;

    for (let seed = 0; seed < runs; seed += 1) {
      const rng = new Rng(seed);
      let ships = randomFleet(rng);
      const opponent = new NormalOpponent(rng);
      let shots = 0;

      for (; shots < 100; shots += 1) {
        const coord: Coord = opponent.nextShot();
        const outcome = resolveShot(ships, coord);
        ships = outcome.ships;
        opponent.observe(outcome.result);
        if (outcome.result.fleetDestroyed) break;
      }
      totalShots += shots + 1;
    }

    const average = totalShots / runs;
    expect(average).toBeGreaterThan(35); // below this, something is leaking positions
    expect(average).toBeLessThan(85); // above this, targeting is not working
  });

  it('exposes no ship data on the opponent object itself', () => {
    const opponent = new NormalOpponent(new Rng(1));
    const serialised = JSON.stringify(opponent);
    expect(serialised).not.toContain('origin');
    expect(serialised).not.toContain('orientation');
  });
});

describe('self-play invariants hold over a long run', () => {
  it('always sinks exactly 17 cells and never exceeds 100 shots', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const rng = new Rng(seed);
      let ships = randomFleet(rng);
      const opponent = new NormalOpponent(rng);
      let hits = 0;
      let shots = 0;
      let finished = false;

      while (shots < 101) {
        const outcome = resolveShot(ships, opponent.nextShot());
        ships = outcome.ships;
        opponent.observe(outcome.result);
        shots += 1;
        if (outcome.result.outcome !== 'miss') hits += 1;
        if (outcome.result.fleetDestroyed) {
          finished = true;
          break;
        }
      }

      expect(finished).toBe(true);
      expect(hits).toBe(TOTAL_SHIP_CELLS);
      expect(shots).toBeLessThanOrEqual(100);
    }
  });
});
