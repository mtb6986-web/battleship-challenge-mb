import { FLEET, TOTAL_SHIP_CELLS } from './types';
import type {
  CellView,
  Coord,
  Difficulty,
  LogEntry,
  Orientation,
  Phase,
  Ship,
  ShipName,
  ShotResult,
  Side,
} from './types';
import {
  canPlace,
  coordKey,
  cellsOf,
  isSunk,
  placementError,
  randomFleet,
  resolveShot,
  rotatedPlacement,
  sameCoord,
} from './board';
import type { PlacementRejection } from './board';
import { Rng } from './rng';
import { createOpponent } from './ai';
import type { Opponent } from './ai';

export interface FleetStatusEntry {
  readonly name: ShipName;
  readonly length: number;
  readonly sunk: boolean;
}

export interface GameSnapshot {
  readonly phase: Phase;
  readonly difficulty: Difficulty;
  readonly seed: number;
  readonly turn: Side;
  readonly awaitingAi: boolean;
  readonly winner: Side | null;
  readonly humanShips: readonly Ship[];
  readonly placedCount: number;
  readonly pendingShips: readonly { name: ShipName; length: number }[];
  readonly orientation: Orientation;
  /** What the human is allowed to see of the AI's board. Never the ship positions. */
  readonly aiBoardView: readonly CellView[][];
  readonly humanBoardView: readonly CellView[][];
  readonly humanFleetStatus: readonly FleetStatusEntry[];
  readonly aiFleetStatus: readonly FleetStatusEntry[];
  readonly log: readonly LogEntry[];
  readonly humanShots: number;
  readonly aiShots: number;
}

function emptyView(): CellView[][] {
  return Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'unknown' as CellView));
}

/**
 * Owns all game state and all rules. Contains no reference to the DOM, window or
 * document, so it runs unchanged inside the self-play harness.
 *
 * The AI's ship positions live in this module's private state only. They are never
 * exposed through `snapshot()` unless `revealAiBoard()` is called explicitly by the
 * ?debug=1 flag. See SPEC.md Section 5.
 */
export class Game {
  private rng: Rng;
  private opponent: Opponent;
  private aiShips: Ship[] = [];
  private humanShips: Ship[] = [];
  private humanShotsFired = new Set<string>();
  private aiShotsFired = new Set<string>();
  private aiView: CellView[][] = emptyView();
  private humanView: CellView[][] = emptyView();
  private logEntries: LogEntry[] = [];
  private phaseValue: Phase = 'placement';
  private turnValue: Side = 'human';
  private winnerValue: Side | null = null;
  private orientationValue: Orientation = 'horizontal';
  private awaitingAiValue = false;

  constructor(
    readonly seed: number,
    private difficultyValue: Difficulty = 'normal',
  ) {
    this.rng = new Rng(seed);
    this.opponent = createOpponent(difficultyValue, this.rng);
    this.aiShips = randomFleet(this.rng);
  }

  /**
   * Full reset to a fresh placement phase. Every piece of AI memory is discarded
   * by constructing a new opponent — there is no partially-cleared state to leak
   * into the next game. See SPEC.md Section 5.
   */
  reset(seed: number = this.seed + 1, difficulty: Difficulty = this.difficultyValue): void {
    this.rng = new Rng(seed);
    this.opponent = createOpponent(difficulty, this.rng);
    this.difficultyValue = difficulty;
    this.aiShips = randomFleet(this.rng);
    this.humanShips = [];
    this.humanShotsFired = new Set();
    this.aiShotsFired = new Set();
    this.aiView = emptyView();
    this.humanView = emptyView();
    this.logEntries = [];
    this.phaseValue = 'placement';
    this.turnValue = 'human';
    this.winnerValue = null;
    this.orientationValue = 'horizontal';
    this.awaitingAiValue = false;
  }

  setDifficulty(difficulty: Difficulty): void {
    if (this.phaseValue !== 'placement') {
      throw new Error('Difficulty can only be changed before the battle starts');
    }
    this.difficultyValue = difficulty;
    this.opponent = createOpponent(difficulty, this.rng);
  }

  // ---------------------------------------------------------------- placement

  get nextShipToPlace(): { name: ShipName; length: number } | null {
    return FLEET[this.humanShips.length] ?? null;
  }

  get orientation(): Orientation {
    return this.orientationValue;
  }

  toggleOrientation(): void {
    this.orientationValue = this.orientationValue === 'horizontal' ? 'vertical' : 'horizontal';
  }

  /**
   * Rotate a ship already on the board. Refuses cleanly or nudges fully on-board;
   * never leaves the ship in a broken state. See SPEC.md Section 5.
   */
  rotatePlacedShip(index: number): boolean {
    const ship = this.humanShips[index];
    if (!ship) return false;

    const others = this.humanShips.filter((_, i) => i !== index);
    const next = rotatedPlacement(ship.origin, ship.length, ship.orientation, others);
    if (!next) return false;

    this.humanShips = this.humanShips.map((s, i) =>
      i === index ? { ...s, origin: next.origin, orientation: next.orientation } : s,
    );
    return true;
  }

  canPlaceNext(origin: Coord): boolean {
    const next = this.nextShipToPlace;
    if (!next) return false;
    return canPlace(origin, next.length, this.orientationValue, this.humanShips);
  }

  placementRejection(origin: Coord): PlacementRejection | null {
    const next = this.nextShipToPlace;
    if (!next) return null;
    return placementError(origin, next.length, this.orientationValue, this.humanShips);
  }

  placeNextShip(origin: Coord): boolean {
    const next = this.nextShipToPlace;
    if (!next || this.phaseValue !== 'placement') return false;
    if (!canPlace(origin, next.length, this.orientationValue, this.humanShips)) return false;

    this.humanShips = [
      ...this.humanShips,
      {
        name: next.name,
        length: next.length,
        origin,
        orientation: this.orientationValue,
        hits: [],
      },
    ];
    return true;
  }

  randomisePlacement(): void {
    if (this.phaseValue !== 'placement') return;
    this.humanShips = randomFleet(this.rng);
  }

  resetPlacement(): void {
    if (this.phaseValue !== 'placement') return;
    this.humanShips = [];
  }

  get allShipsPlaced(): boolean {
    return this.humanShips.length === FLEET.length;
  }

  startBattle(): boolean {
    if (!this.allShipsPlaced || this.phaseValue !== 'placement') return false;
    this.phaseValue = 'battle';
    this.turnValue = 'human';
    return true;
  }

  // ------------------------------------------------------------------- battle

  canFireAt(coord: Coord): boolean {
    return (
      this.phaseValue === 'battle' &&
      this.turnValue === 'human' &&
      !this.awaitingAiValue &&
      !this.humanShotsFired.has(coordKey(coord))
    );
  }

  /**
   * Human fires one shot. Returns null if the shot was refused, which crucially
   * does NOT consume the turn. See SPEC.md Section 4.
   */
  fireAtAi(coord: Coord): ShotResult | null {
    if (!this.canFireAt(coord)) return null;

    this.humanShotsFired.add(coordKey(coord));
    const { ships, result } = resolveShot(this.aiShips, coord);
    this.aiShips = ships;
    this.applyToView(this.aiView, this.aiShips, result);
    this.logEntries.push(this.toLogEntry('human', result));

    if (result.fleetDestroyed) {
      this.finish('human');
    } else {
      this.turnValue = 'ai';
      this.awaitingAiValue = true;
    }
    return result;
  }

  /** AI takes its single shot. Returns null when it is not the AI's turn. */
  takeAiTurn(): ShotResult | null {
    if (this.phaseValue !== 'battle' || this.turnValue !== 'ai') return null;

    const coord = this.opponent.nextShot();
    this.aiShotsFired.add(coordKey(coord));
    const { ships, result } = resolveShot(this.humanShips, coord);
    this.humanShips = ships;
    this.opponent.observe(result);
    this.applyToView(this.humanView, this.humanShips, result);
    this.logEntries.push(this.toLogEntry('ai', result));

    if (result.fleetDestroyed) {
      this.finish('ai');
    } else {
      this.turnValue = 'human';
      this.awaitingAiValue = false;
    }
    return result;
  }

  private finish(winner: Side): void {
    this.winnerValue = winner;
    this.phaseValue = 'over';
    this.awaitingAiValue = false;
  }

  private toLogEntry(side: Side, result: ShotResult): LogEntry {
    return {
      side,
      coord: result.coord,
      outcome: result.outcome,
      sunkShip: result.sunkShip,
    };
  }

  /** A sunk ship's whole footprint is revealed, so the board reads correctly. */
  private applyToView(view: CellView[][], ships: readonly Ship[], result: ShotResult): void {
    view[result.coord.row][result.coord.col] = result.outcome === 'miss' ? 'miss' : 'hit';

    if (result.sunkShip !== null) {
      const sunk = ships.find((ship) => ship.name === result.sunkShip);
      if (sunk) {
        for (const cell of cellsOf(sunk)) view[cell.row][cell.col] = 'sunk';
      }
    }
  }

  // ------------------------------------------------------------------ reading

  private fleetStatus(ships: readonly Ship[]): FleetStatusEntry[] {
    return FLEET.map((shipClass) => {
      const ship = ships.find((s) => s.name === shipClass.name);
      return {
        name: shipClass.name,
        length: shipClass.length,
        sunk: ship ? isSunk(ship) : false,
      };
    });
  }

  snapshot(): GameSnapshot {
    return {
      phase: this.phaseValue,
      difficulty: this.difficultyValue,
      seed: this.seed,
      turn: this.turnValue,
      awaitingAi: this.awaitingAiValue,
      winner: this.winnerValue,
      humanShips: this.humanShips,
      placedCount: this.humanShips.length,
      pendingShips: FLEET.slice(this.humanShips.length).map((s) => ({
        name: s.name,
        length: s.length,
      })),
      orientation: this.orientationValue,
      aiBoardView: this.aiView.map((row) => [...row]),
      humanBoardView: this.humanView.map((row) => [...row]),
      humanFleetStatus: this.fleetStatus(this.humanShips),
      aiFleetStatus: this.fleetStatus(this.aiShips),
      log: [...this.logEntries],
      humanShots: this.humanShotsFired.size,
      aiShots: this.aiShotsFired.size,
    };
  }

  /**
   * The AI's ship positions. Only ever called behind the ?debug=1 flag, and never
   * reachable from the rendered page otherwise. See SPEC.md Section 5.
   */
  revealAiBoard(): readonly Ship[] {
    return this.aiShips;
  }

  /** Test/harness hook: place the human fleet directly, bypassing the UI. */
  setHumanFleet(ships: readonly Ship[]): void {
    this.humanShips = [...ships];
  }

  get humanHitsTaken(): number {
    return this.humanShips.reduce((sum, ship) => sum + ship.hits.length, 0);
  }

  get aiHitsTaken(): number {
    return this.aiShips.reduce((sum, ship) => sum + ship.hits.length, 0);
  }

  get maxHits(): number {
    return TOTAL_SHIP_CELLS;
  }

  hasHumanFiredAt(coord: Coord): boolean {
    return this.humanShotsFired.has(coordKey(coord));
  }

  humanShipAt(coord: Coord): Ship | null {
    return this.humanShips.find((ship) => cellsOf(ship).some((c) => sameCoord(c, coord))) ?? null;
  }
}
