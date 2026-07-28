import { describe, expect, it } from 'vitest';
import {
  canPlace,
  coordLabel,
  parseCoordLabel,
  placementError,
  randomFleet,
  resolveShot,
  rotatedPlacement,
  shipCells,
  validateFleet,
} from '../src/game/board';
import { Rng } from '../src/game/rng';
import { FLEET, TOTAL_SHIP_CELLS } from '../src/game/types';
import type { Ship } from '../src/game/types';

const ship = (
  name: Ship['name'],
  length: number,
  row: number,
  col: number,
  orientation: Ship['orientation'] = 'horizontal',
): Ship => ({ name, length, origin: { row, col }, orientation, hits: [] });

describe('coordinate labels', () => {
  it('maps the corners to A1 and J10', () => {
    expect(coordLabel({ row: 0, col: 0 })).toBe('A1');
    expect(coordLabel({ row: 9, col: 9 })).toBe('J10');
  });

  it('round-trips through parsing', () => {
    for (const label of ['A1', 'B7', 'J10', 'E5']) {
      expect(coordLabel(parseCoordLabel(label)!)).toBe(label);
    }
  });

  it('rejects labels outside the board', () => {
    expect(parseCoordLabel('K1')).toBeNull();
    expect(parseCoordLabel('A11')).toBeNull();
    expect(parseCoordLabel('A0')).toBeNull();
  });
});

describe('placement validation', () => {
  it('never wraps a horizontal ship from the right edge onto the next row', () => {
    // Destroyer of length 2 starting at J1 (col 9) would need col 10.
    expect(canPlace({ row: 0, col: 9 }, 2, 'horizontal', [])).toBe(false);
    expect(placementError({ row: 0, col: 9 }, 2, 'horizontal', [])).toBe('off-board');

    // The cells it would want must not silently become row 1 col 0.
    const cells = shipCells({ row: 0, col: 9 }, 2, 'horizontal');
    expect(cells[1]).toEqual({ row: 0, col: 10 });
    expect(cells[1].row).toBe(0);
  });

  it('never runs a vertical ship off the bottom edge', () => {
    expect(canPlace({ row: 9, col: 0 }, 2, 'vertical', [])).toBe(false);
    expect(canPlace({ row: 8, col: 0 }, 2, 'vertical', [])).toBe(true);
  });

  it('allows a ship that exactly reaches the edge', () => {
    expect(canPlace({ row: 0, col: 5 }, 5, 'horizontal', [])).toBe(true);
    expect(canPlace({ row: 5, col: 9 }, 5, 'vertical', [])).toBe(true);
  });

  it('rejects overlapping ships', () => {
    const existing = [ship('Carrier', 5, 3, 2)];
    expect(canPlace({ row: 3, col: 4 }, 3, 'horizontal', existing)).toBe(false);
    expect(placementError({ row: 3, col: 4 }, 3, 'horizontal', existing)).toBe('overlap');
  });

  it('allows ships to touch side by side', () => {
    const existing = [ship('Carrier', 5, 3, 2)];
    expect(canPlace({ row: 4, col: 2 }, 3, 'horizontal', existing)).toBe(true);
  });

  it('allows ships to touch corner to corner', () => {
    const existing = [ship('Destroyer', 2, 3, 3)];
    expect(canPlace({ row: 4, col: 5 }, 2, 'horizontal', existing)).toBe(true);
  });
});

describe('rotation', () => {
  it('nudges a ship fully on-board rather than leaving it broken', () => {
    // Carrier lying horizontally at F1 (col 5..9). Rotating needs rows 0..4, which fits.
    const result = rotatedPlacement({ row: 0, col: 5 }, 5, 'horizontal', []);
    expect(result).not.toBeNull();
    expect(shipCells(result!.origin, 5, result!.orientation).every((c) => c.row < 10 && c.col < 10)).toBe(
      true,
    );
  });

  it('nudges a ship back on-board when rotating near the bottom edge', () => {
    const result = rotatedPlacement({ row: 8, col: 3 }, 4, 'horizontal', []);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe('vertical');
    expect(result!.origin.row).toBe(6);
  });

  it('refuses cleanly when neither the original nor the nudged position is legal', () => {
    const blockers: Ship[] = [
      ship('Carrier', 5, 0, 4, 'vertical'),
      ship('Battleship', 4, 5, 4, 'vertical'),
    ];
    expect(rotatedPlacement({ row: 3, col: 4 }, 3, 'horizontal', blockers)).toBeNull();
  });
});

describe('shot resolution', () => {
  const fleet = [ship('Destroyer', 2, 0, 0)];

  it('reports a miss without changing the fleet', () => {
    const { ships, result } = resolveShot(fleet, { row: 5, col: 5 });
    expect(result.outcome).toBe('miss');
    expect(ships[0].hits).toHaveLength(0);
  });

  it('reports a hit that does not yet sink', () => {
    const { result } = resolveShot(fleet, { row: 0, col: 0 });
    expect(result.outcome).toBe('hit');
    expect(result.sunkShip).toBeNull();
  });

  it('reports a sink by name once every cell is hit', () => {
    const first = resolveShot(fleet, { row: 0, col: 0 });
    const second = resolveShot(first.ships, { row: 0, col: 1 });
    expect(second.result.outcome).toBe('sunk');
    expect(second.result.sunkShip).toBe('Destroyer');
    expect(second.result.fleetDestroyed).toBe(true);
  });

  it('detects a sink when the final cell sits on the outer edge', () => {
    const edgeFleet = [ship('Destroyer', 2, 9, 8)];
    const first = resolveShot(edgeFleet, { row: 9, col: 8 });
    const second = resolveShot(first.ships, { row: 9, col: 9 });
    expect(second.result.outcome).toBe('sunk');
    expect(second.result.sunkShip).toBe('Destroyer');
  });

  it('detects a sink in the very corner of the board', () => {
    const cornerFleet = [ship('Destroyer', 2, 8, 9, 'vertical')];
    const first = resolveShot(cornerFleet, { row: 8, col: 9 });
    const second = resolveShot(first.ships, { row: 9, col: 9 });
    expect(second.result.sunkShip).toBe('Destroyer');
  });

  it('does not double-count a repeated shot on the same cell', () => {
    const first = resolveShot(fleet, { row: 0, col: 0 });
    const second = resolveShot(first.ships, { row: 0, col: 0 });
    expect(second.ships[0].hits).toHaveLength(1);
    expect(second.result.outcome).toBe('miss');
  });

  it('only declares the fleet destroyed on the seventeenth hit', () => {
    let ships = randomFleet(new Rng(7));
    const cells = ships.flatMap((s) => shipCells(s.origin, s.length, s.orientation));
    expect(cells).toHaveLength(TOTAL_SHIP_CELLS);

    cells.forEach((cell, index) => {
      const outcome = resolveShot(ships, cell);
      ships = outcome.ships;
      expect(outcome.result.fleetDestroyed).toBe(index === TOTAL_SHIP_CELLS - 1);
    });
  });
});

describe('random fleet generation', () => {
  it('produces a legal fleet every time across many seeds', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const fleet = randomFleet(new Rng(seed));
      expect(validateFleet(fleet)).toBeNull();
      expect(fleet).toHaveLength(FLEET.length);
    }
  });

  it('is reproducible for a given seed', () => {
    expect(randomFleet(new Rng(99))).toEqual(randomFleet(new Rng(99)));
  });

  it('produces different fleets for different seeds', () => {
    expect(randomFleet(new Rng(1))).not.toEqual(randomFleet(new Rng(2)));
  });
});

describe('fleet validation catches the things it is meant to catch', () => {
  it('flags a ship hanging off the board', () => {
    expect(validateFleet([ship('Destroyer', 2, 0, 9)])).not.toBeNull();
  });

  it('flags the wrong number of ships', () => {
    expect(validateFleet([ship('Destroyer', 2, 0, 0)])).toBe('wrong-ship-count');
  });
});
