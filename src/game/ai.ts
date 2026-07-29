import { BOARD_SIZE, FLEET } from './types';
import type { Coord, Difficulty, ShipName, ShotResult } from './types';
import { coordKey, inBounds, sameCoord } from './board';
import type { Rng } from './rng';

/**
 * The AI knows only the fleet composition and its own shot history. It is never
 * given the opponent's ship positions — see SPEC.md Section 6.
 */
export interface Opponent {
  nextShot(): Coord;
  observe(result: ShotResult): void;
  readonly difficulty: Difficulty;
}

function orthogonalNeighbours(coord: Coord): Coord[] {
  return [
    { row: coord.row - 1, col: coord.col },
    { row: coord.row + 1, col: coord.col },
    { row: coord.row, col: coord.col - 1 },
    { row: coord.row, col: coord.col + 1 },
  ].filter(inBounds);
}

abstract class BaseOpponent implements Opponent {
  protected readonly fired = new Set<string>();

  constructor(protected readonly rng: Rng) {}

  abstract readonly difficulty: Difficulty;
  protected abstract chooseShot(): Coord;

  nextShot(): Coord {
    const coord = this.chooseShot();
    if (!inBounds(coord)) throw new Error(`AI chose an off-board cell: ${coordKey(coord)}`);
    if (this.fired.has(coordKey(coord))) {
      throw new Error(`AI chose an already-fired cell: ${coordKey(coord)}`);
    }
    this.fired.add(coordKey(coord));
    return coord;
  }

  observe(_result: ShotResult): void {}

  protected unfiredCells(predicate?: (coord: Coord) => boolean): Coord[] {
    const cells: Coord[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const coord = { row, col };
        if (this.fired.has(coordKey(coord))) continue;
        if (predicate && !predicate(coord)) continue;
        cells.push(coord);
      }
    }
    return cells;
  }
}

/** Easy: uniform random among un-fired cells. No targeting at all. */
export class EasyOpponent extends BaseOpponent {
  readonly difficulty = 'easy' as const;

  protected chooseShot(): Coord {
    return this.rng.pick(this.unfiredCells());
  }
}

/**
 * Normal: parity hunt, then target.
 *
 * Sink handling tracks *unresolved hits* rather than clearing the queue, because
 * ships may touch and a queued cell may belong to a different, still-floating ship.
 * See SPEC.md Section 6 [REV 3].
 */
export class NormalOpponent extends BaseOpponent {
  readonly difficulty = 'normal' as const;

  private queue: Coord[] = [];
  private unresolvedHits: Coord[] = [];

  protected chooseShot(): Coord {
    const axisShot = this.axisExtension();
    if (axisShot) return axisShot;

    while (this.queue.length > 0) {
      const candidate = this.queue.shift();
      if (candidate && !this.fired.has(coordKey(candidate))) return candidate;
    }

    return this.hunt();
  }

  /**
   * Two unresolved hits in a line reveal the ship's axis; extend along it and
   * ignore the perpendicular neighbours.
   */
  private axisExtension(): Coord | null {
    for (let i = 0; i < this.unresolvedHits.length; i += 1) {
      for (let j = i + 1; j < this.unresolvedHits.length; j += 1) {
        const a = this.unresolvedHits[i];
        const b = this.unresolvedHits[j];

        if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
          const cols = this.unresolvedHits.filter((h) => h.row === a.row).map((h) => h.col);
          const candidates = [
            { row: a.row, col: Math.min(...cols) - 1 },
            { row: a.row, col: Math.max(...cols) + 1 },
          ];
          const shot = candidates.find((c) => inBounds(c) && !this.fired.has(coordKey(c)));
          if (shot) return shot;
        }

        if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
          const rows = this.unresolvedHits.filter((h) => h.col === a.col).map((h) => h.row);
          const candidates = [
            { row: Math.min(...rows) - 1, col: a.col },
            { row: Math.max(...rows) + 1, col: a.col },
          ];
          const shot = candidates.find((c) => inBounds(c) && !this.fired.has(coordKey(c)));
          if (shot) return shot;
        }
      }
    }
    return null;
  }

  /**
   * Parity: the smallest ship is 2 cells long, so it must cover a cell where
   * (row + col) is odd. Halves the search space with no loss of coverage.
   */
  private hunt(): Coord {
    const parity = this.unfiredCells((c) => (c.row + c.col) % 2 === 1);
    return this.rng.pick(parity.length > 0 ? parity : this.unfiredCells());
  }

  observe(result: ShotResult): void {
    if (result.outcome === 'hit' || result.outcome === 'sunk') {
      this.unresolvedHits.push(result.coord);
      for (const neighbour of orthogonalNeighbours(result.coord)) {
        if (!this.fired.has(coordKey(neighbour))) this.queue.push(neighbour);
      }
    }

    if (result.sunkShip !== null) {
      this.resolveSunkShip(result.coord, result.sunkShip);
    }
  }

  /**
   * Remove only the sunk ship's own cells from the unresolved list. Any hits left
   * over belong to a different ship, so stay in target mode and keep working them.
   */
  private resolveSunkShip(finalHit: Coord, sunkShip: ShipName): void {
    const sunkCells = this.sunkShipCells(finalHit, sunkShip);
    this.unresolvedHits = this.unresolvedHits.filter(
      (hit) => !sunkCells.some((cell) => sameCoord(cell, hit)),
    );

    if (this.unresolvedHits.length === 0) {
      this.queue = [];
    }
  }

  /**
   * Work out which cells the sunk ship occupied, using only the AI's own hit record
   * and the publicly known fleet lengths.
   *
   * Because ships may touch, the killing shot can sit inside a longer line of hits
   * spanning two ships, and which cells belonged to which is genuinely not knowable
   * from the AI's information. So this resolves only the cells common to *every*
   * placement consistent with what it knows.
   *
   * The asymmetry is deliberate. Under-claiming costs at most a couple of wasted
   * shots at cells that turn out to be already dead. Over-claiming writes off a hit
   * on a live ship and abandons the lead entirely — that was BUG-001.
   */
  private sunkShipCells(finalHit: Coord, sunkShip: ShipName): Coord[] {
    const length = FLEET.find((s) => s.name === sunkShip)?.length ?? 1;

    const windows = [this.runThrough(finalHit, 0, 1), this.runThrough(finalHit, 1, 0)].flatMap(
      (run) => this.windowsContaining(run, finalHit, length),
    );

    if (windows.length === 0) return [finalHit];

    return windows[0].filter((cell) =>
      windows.every((window) => window.some((other) => sameCoord(other, cell))),
    );
  }

  /** Every contiguous run of `length` cells within `run` that includes the killing shot. */
  private windowsContaining(run: readonly Coord[], finalHit: Coord, length: number): Coord[][] {
    if (run.length < length) return [];

    const index = run.findIndex((cell) => sameCoord(cell, finalHit));
    const windows: Coord[][] = [];

    for (let start = index - length + 1; start <= index; start += 1) {
      if (start < 0 || start + length > run.length) continue;
      windows.push(run.slice(start, start + length));
    }
    return windows;
  }

  /**
   * Contiguous unresolved hits through `from` along one axis, ordered along that
   * axis and including `from`.
   */
  private runThrough(from: Coord, dr: number, dc: number): Coord[] {
    const inUnresolved = (c: Coord) => this.unresolvedHits.some((h) => sameCoord(h, c));
    const before: Coord[] = [];
    const after: Coord[] = [];

    for (const [sign, bucket] of [
      [-1, before],
      [1, after],
    ] as const) {
      let cursor = { row: from.row + dr * sign, col: from.col + dc * sign };
      while (inBounds(cursor) && inUnresolved(cursor)) {
        bucket.push(cursor);
        cursor = { row: cursor.row + dr * sign, col: cursor.col + dc * sign };
      }
    }

    return [...before.reverse(), from, ...after];
  }
}

export function createOpponent(difficulty: Difficulty, rng: Rng): Opponent {
  return difficulty === 'easy' ? new EasyOpponent(rng) : new NormalOpponent(rng);
}
