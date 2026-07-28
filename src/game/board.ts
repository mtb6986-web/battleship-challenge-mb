import { BOARD_SIZE, FLEET, TOTAL_SHIP_CELLS } from './types';
import type { Coord, Orientation, Ship, ShipName, ShotResult } from './types';
import type { Rng } from './rng';

export function coordKey(coord: Coord): string {
  return `${coord.row},${coord.col}`;
}

export function coordLabel(coord: Coord): string {
  return `${String.fromCharCode(65 + coord.col)}${coord.row + 1}`;
}

export function parseCoordLabel(label: string): Coord | null {
  const match = /^([A-J])(10|[1-9])$/i.exec(label.trim());
  if (!match) return null;
  return { row: Number(match[2]) - 1, col: match[1].toUpperCase().charCodeAt(0) - 65 };
}

export function inBounds(coord: Coord): boolean {
  return coord.row >= 0 && coord.row < BOARD_SIZE && coord.col >= 0 && coord.col < BOARD_SIZE;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

/**
 * Cells a ship would occupy. Row and column are advanced separately so a
 * horizontal ship can never wrap off the right edge onto the next row.
 */
export function shipCells(origin: Coord, length: number, orientation: Orientation): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < length; i += 1) {
    cells.push(
      orientation === 'horizontal'
        ? { row: origin.row, col: origin.col + i }
        : { row: origin.row + i, col: origin.col },
    );
  }
  return cells;
}

export function cellsOf(ship: Ship): Coord[] {
  return shipCells(ship.origin, ship.length, ship.orientation);
}

export type PlacementRejection = 'off-board' | 'overlap';

export function placementError(
  origin: Coord,
  length: number,
  orientation: Orientation,
  existing: readonly Ship[],
): PlacementRejection | null {
  const cells = shipCells(origin, length, orientation);
  if (cells.some((cell) => !inBounds(cell))) return 'off-board';

  const taken = new Set(existing.flatMap((ship) => cellsOf(ship).map(coordKey)));
  if (cells.some((cell) => taken.has(coordKey(cell)))) return 'overlap';

  // Ships may touch, including corner to corner. Adjacency is deliberately legal.
  return null;
}

export function canPlace(
  origin: Coord,
  length: number,
  orientation: Orientation,
  existing: readonly Ship[],
): boolean {
  return placementError(origin, length, orientation, existing) === null;
}

export function legalOrigins(
  length: number,
  orientation: Orientation,
  existing: readonly Ship[],
): Coord[] {
  const origins: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const origin = { row, col };
      if (canPlace(origin, length, orientation, existing)) origins.push(origin);
    }
  }
  return origins;
}

/**
 * Rotate in place if legal; otherwise nudge back on-board and retry. Returns null
 * when neither works, so the caller refuses cleanly rather than leaving a broken ship.
 */
export function rotatedPlacement(
  origin: Coord,
  length: number,
  current: Orientation,
  others: readonly Ship[],
): { origin: Coord; orientation: Orientation } | null {
  const orientation: Orientation = current === 'horizontal' ? 'vertical' : 'horizontal';

  const nudged: Coord =
    orientation === 'horizontal'
      ? { row: origin.row, col: Math.min(origin.col, BOARD_SIZE - length) }
      : { row: Math.min(origin.row, BOARD_SIZE - length), col: origin.col };

  for (const candidate of [origin, nudged]) {
    if (canPlace(candidate, length, orientation, others)) return { origin: candidate, orientation };
  }
  return null;
}

export function randomFleet(rng: Rng): Ship[] {
  const ships: Ship[] = [];
  for (const shipClass of FLEET) {
    const orientation: Orientation = rng.bool() ? 'horizontal' : 'vertical';
    const options = legalOrigins(shipClass.length, orientation, ships);
    // A five-ship fleet on a 10x10 board can never exhaust both orientations.
    const fallback =
      options.length > 0 ? orientation : orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const origins = options.length > 0 ? options : legalOrigins(shipClass.length, fallback, ships);
    ships.push({
      name: shipClass.name,
      length: shipClass.length,
      origin: rng.pick(origins),
      orientation: fallback,
      hits: [],
    });
  }
  return ships;
}

export function isSunk(ship: Ship): boolean {
  return ship.hits.length === ship.length;
}

export function fleetDestroyed(ships: readonly Ship[]): boolean {
  return ships.every(isSunk);
}

export interface FleetShotOutcome {
  readonly ships: Ship[];
  readonly result: ShotResult;
}

/** Resolve one shot against a fleet. Pure: returns a new fleet, mutates nothing. */
export function resolveShot(ships: readonly Ship[], coord: Coord): FleetShotOutcome {
  let sunkShip: ShipName | null = null;

  const next = ships.map((ship) => {
    if (!cellsOf(ship).some((cell) => sameCoord(cell, coord))) return ship;
    if (ship.hits.some((hit) => sameCoord(hit, coord))) return ship;

    const hitShip: Ship = { ...ship, hits: [...ship.hits, coord] };
    if (isSunk(hitShip)) sunkShip = hitShip.name;
    return hitShip;
  });

  const hit = next.some((ship, i) => ship.hits.length !== ships[i].hits.length);
  const destroyed = fleetDestroyed(next);

  return {
    ships: next,
    result: {
      coord,
      outcome: sunkShip !== null ? 'sunk' : hit ? 'hit' : 'miss',
      sunkShip,
      fleetDestroyed: destroyed,
    },
  };
}

export type FleetValidationError =
  'wrong-ship-count' | 'wrong-length' | 'off-board' | 'overlap' | 'wrong-total-cells';

/** Independent checker used by the self-play harness to audit generated fleets. */
export function validateFleet(ships: readonly Ship[]): FleetValidationError | null {
  if (ships.length !== FLEET.length) return 'wrong-ship-count';

  const seen = new Set<string>();
  for (const ship of ships) {
    const expected = FLEET.find((s) => s.name === ship.name);
    if (!expected || expected.length !== ship.length) return 'wrong-length';

    const cells = cellsOf(ship);
    if (cells.some((cell) => !inBounds(cell))) return 'off-board';
    for (const cell of cells) {
      const key = coordKey(cell);
      if (seen.has(key)) return 'overlap';
      seen.add(key);
    }
  }

  if (seen.size !== TOTAL_SHIP_CELLS) return 'wrong-total-cells';
  return null;
}
