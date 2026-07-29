export const BOARD_SIZE = 10;

export type ShipName = 'Carrier' | 'Battleship' | 'Cruiser' | 'Submarine' | 'Destroyer';

export interface ShipClass {
  readonly name: ShipName;
  readonly length: number;
}

export const FLEET: readonly ShipClass[] = [
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
] as const;

export const TOTAL_SHIP_CELLS = FLEET.reduce((sum, ship) => sum + ship.length, 0);

export type Orientation = 'horizontal' | 'vertical';

export interface Coord {
  readonly row: number;
  readonly col: number;
}

export interface Ship {
  readonly name: ShipName;
  readonly length: number;
  readonly origin: Coord;
  readonly orientation: Orientation;
  readonly hits: readonly Coord[];
}

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

export interface ShotResult {
  readonly coord: Coord;
  readonly outcome: ShotOutcome;
  readonly sunkShip: ShipName | null;
  readonly fleetDestroyed: boolean;
}

export type CellView = 'unknown' | 'miss' | 'hit' | 'sunk';

export type Side = 'human' | 'ai';

export type Difficulty = 'easy' | 'normal';

export type Phase = 'placement' | 'battle' | 'over';

export interface LogEntry {
  readonly side: Side;
  readonly coord: Coord;
  readonly outcome: ShotOutcome;
  readonly sunkShip: ShipName | null;
}
