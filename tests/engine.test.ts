import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/engine';
import { cellsOf, coordKey } from '../src/game/board';
import { FLEET, TOTAL_SHIP_CELLS } from '../src/game/types';
import type { Coord } from '../src/game/types';

function readyGame(seed = 42): Game {
  const game = new Game(seed, 'normal');
  game.randomisePlacement();
  game.startBattle();
  return game;
}

/** Fire at the AI, then let the AI reply, until someone wins. */
function playToCompletion(game: Game): void {
  const cells: Coord[] = [];
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) cells.push({ row, col });
  }

  for (const cell of cells) {
    if (game.snapshot().phase === 'over') break;
    game.fireAtAi(cell);
    game.takeAiTurn();
  }
}

describe('placement phase', () => {
  it('starts with all five ships waiting to be placed', () => {
    const game = new Game(1);
    expect(game.snapshot().pendingShips).toHaveLength(FLEET.length);
    expect(game.allShipsPlaced).toBe(false);
  });

  it('refuses to start the battle until all five ships are placed', () => {
    const game = new Game(1);
    expect(game.startBattle()).toBe(false);
    game.placeNextShip({ row: 0, col: 0 });
    expect(game.startBattle()).toBe(false);

    game.randomisePlacement();
    expect(game.allShipsPlaced).toBe(true);
    expect(game.startBattle()).toBe(true);
  });

  it('places ships in fleet order', () => {
    const game = new Game(1);
    expect(game.nextShipToPlace?.name).toBe('Carrier');
    game.placeNextShip({ row: 0, col: 0 });
    expect(game.nextShipToPlace?.name).toBe('Battleship');
  });

  it('refuses an illegal placement without consuming the ship', () => {
    const game = new Game(1);
    expect(game.placeNextShip({ row: 0, col: 9 })).toBe(false);
    expect(game.nextShipToPlace?.name).toBe('Carrier');
  });

  it('random placement is legal every time over many attempts', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const game = new Game(seed);
      game.randomisePlacement();
      const snapshot = game.snapshot();
      expect(snapshot.humanShips).toHaveLength(FLEET.length);

      const cells = snapshot.humanShips.flatMap(cellsOf);
      expect(new Set(cells.map(coordKey)).size).toBe(TOTAL_SHIP_CELLS);
      expect(cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10)).toBe(true);
    }
  });

  it('reset placement clears the board', () => {
    const game = new Game(1);
    game.randomisePlacement();
    game.resetPlacement();
    expect(game.snapshot().placedCount).toBe(0);
  });

  it('rotating a placed ship never leaves it off the board', () => {
    const game = new Game(1);
    game.randomisePlacement();
    for (let i = 0; i < FLEET.length; i += 1) {
      game.rotatePlacedShip(i);
      const cells = game.snapshot().humanShips.flatMap(cellsOf);
      expect(cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10)).toBe(true);
      expect(new Set(cells.map(coordKey)).size).toBe(TOTAL_SHIP_CELLS);
    }
  });
});

describe('turn order and firing rules', () => {
  it('the human always fires first', () => {
    expect(readyGame().snapshot().turn).toBe('human');
  });

  it('a hit does not grant another shot', () => {
    const game = readyGame();
    const target = cellsOf(game.revealAiBoard()[0])[0];

    const result = game.fireAtAi(target);
    expect(result?.outcome).not.toBe('miss');
    expect(game.snapshot().turn).toBe('ai');
  });

  it('refuses a repeat shot and does not consume the turn', () => {
    const game = readyGame();
    game.fireAtAi({ row: 0, col: 0 });
    game.takeAiTurn();

    expect(game.snapshot().turn).toBe('human');
    expect(game.fireAtAi({ row: 0, col: 0 })).toBeNull();
    expect(game.snapshot().turn).toBe('human');
    expect(game.snapshot().humanShots).toBe(1);
  });

  it('ignores extra shots fired while the AI is thinking', () => {
    const game = readyGame();
    game.fireAtAi({ row: 0, col: 0 });

    expect(game.snapshot().awaitingAi).toBe(true);
    expect(game.fireAtAi({ row: 1, col: 1 })).toBeNull();
    expect(game.fireAtAi({ row: 2, col: 2 })).toBeNull();
    expect(game.snapshot().humanShots).toBe(1);
  });

  it('the AI cannot take two turns in a row', () => {
    const game = readyGame();
    game.fireAtAi({ row: 0, col: 0 });
    expect(game.takeAiTurn()).not.toBeNull();
    expect(game.takeAiTurn()).toBeNull();
  });
});

describe('winning', () => {
  it('ends the moment the seventeenth cell is hit, with no retaliation', () => {
    const game = readyGame();
    const aiCells = game.revealAiBoard().flatMap(cellsOf);

    aiCells.forEach((cell, index) => {
      const result = game.fireAtAi(cell);
      expect(result).not.toBeNull();
      if (index < aiCells.length - 1) game.takeAiTurn();
    });

    const snapshot = game.snapshot();
    expect(snapshot.phase).toBe('over');
    expect(snapshot.winner).toBe('human');
    expect(snapshot.humanShots).toBe(TOTAL_SHIP_CELLS);
    // The AI got one fewer turn: it never fires after losing.
    expect(snapshot.aiShots).toBe(TOTAL_SHIP_CELLS - 1);
  });

  it('blocks all further shots once the game is over', () => {
    const game = readyGame();
    for (const cell of game.revealAiBoard().flatMap(cellsOf)) {
      game.fireAtAi(cell);
      if (game.snapshot().phase !== 'over') game.takeAiTurn();
    }

    expect(game.fireAtAi({ row: 0, col: 0 })).toBeNull();
    expect(game.takeAiTurn()).toBeNull();
  });

  it('announces the sunk ship by name', () => {
    const game = readyGame();
    const carrier = game.revealAiBoard().find((s) => s.name === 'Carrier')!;
    const cells = cellsOf(carrier);

    let sunkName: string | null = null;
    cells.forEach((cell) => {
      const result = game.fireAtAi(cell);
      if (result?.sunkShip) sunkName = result.sunkShip;
      if (game.snapshot().phase !== 'over') game.takeAiTurn();
    });

    expect(sunkName).toBe('Carrier');
  });

  it('always produces exactly one winner and never a draw', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const game = readyGame(seed);
      playToCompletion(game);
      const snapshot = game.snapshot();
      expect(snapshot.phase).toBe('over');
      expect(snapshot.winner === 'human' || snapshot.winner === 'ai').toBe(true);
    }
  });
});

describe('full reset via Play again', () => {
  it('clears every board, log and fleet status', () => {
    const game = readyGame();
    playToCompletion(game);
    game.reset();

    const snapshot = game.snapshot();
    expect(snapshot.phase).toBe('placement');
    expect(snapshot.winner).toBeNull();
    expect(snapshot.turn).toBe('human');
    expect(snapshot.log).toHaveLength(0);
    expect(snapshot.humanShots).toBe(0);
    expect(snapshot.aiShots).toBe(0);
    expect(snapshot.placedCount).toBe(0);
    expect(snapshot.aiBoardView.flat().every((cell) => cell === 'unknown')).toBe(true);
    expect(snapshot.humanBoardView.flat().every((cell) => cell === 'unknown')).toBe(true);
    expect(snapshot.humanFleetStatus.every((s) => !s.sunk)).toBe(true);
    expect(snapshot.aiFleetStatus.every((s) => !s.sunk)).toBe(true);
  });

  it('gives the AI a completely fresh memory, so it hunts from scratch', () => {
    const game = readyGame();
    playToCompletion(game);
    game.reset();
    game.randomisePlacement();
    game.startBattle();

    // Its very first shot of the new game must obey the opening parity rule, which
    // is only true of an opponent that has fired nothing yet.
    game.fireAtAi({ row: 0, col: 0 });
    game.takeAiTurn();
    const firstAiShot = game.snapshot().log.find((entry) => entry.side === 'ai')!;
    expect((firstAiShot.coord.row + firstAiShot.coord.col) % 2).toBe(1);
  });

  it('the second and third games behave exactly like the first', () => {
    const game = new Game(500, 'normal');
    const lengths: number[] = [];

    for (let round = 0; round < 3; round += 1) {
      if (round > 0) game.reset(500);
      game.randomisePlacement();
      game.startBattle();
      playToCompletion(game);

      const snapshot = game.snapshot();
      expect(snapshot.phase).toBe('over');
      lengths.push(snapshot.log.length);
    }

    // Same seed each round, so all three games are identical.
    expect(new Set(lengths).size).toBe(1);
  });

  it('a fresh reset re-randomises the AI fleet when the seed advances', () => {
    const game = new Game(77);
    const before = JSON.stringify(game.revealAiBoard());
    game.reset();
    expect(JSON.stringify(game.revealAiBoard())).not.toBe(before);
  });
});

describe('what the player is allowed to see', () => {
  it('the snapshot exposes no ship placements other than the human player’s own', () => {
    const game = readyGame();
    game.fireAtAi({ row: 0, col: 0 });

    const snapshot = game.snapshot();
    const humanFootprint = new Set(snapshot.humanShips.flatMap(cellsOf).map(coordKey));

    // Walk the whole snapshot looking for anything shaped like a placed ship. The
    // only ones allowed are the player's own; an AI ship appearing anywhere here
    // would put its position into the rendered page.
    const found: { origin: Coord; orientation: string; length: number }[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value === null || typeof value !== 'object') return;

      const record = value as Record<string, unknown>;
      if ('origin' in record && 'orientation' in record && 'length' in record) {
        found.push(record as unknown as (typeof found)[number]);
      }
      Object.values(record).forEach(walk);
    };
    walk(snapshot);

    // Exactly five placed ships are reachable, and every cell of every one of them
    // belongs to the player's own fleet. There is nowhere for an AI ship to hide.
    expect(found).toHaveLength(FLEET.length);
    for (const ship of found) {
      expect(cellsOf(ship as never).every((cell) => humanFootprint.has(coordKey(cell)))).toBe(true);
    }
    expect(found).toEqual([...snapshot.humanShips]);
  });

  it('an unhit AI cell is reported as unknown, not as water or ship', () => {
    const game = readyGame();
    const carrierCell = cellsOf(game.revealAiBoard()[0])[0];
    expect(game.snapshot().aiBoardView[carrierCell.row][carrierCell.col]).toBe('unknown');
  });

  it("the AI's board view starts entirely unknown", () => {
    expect(
      readyGame()
        .snapshot()
        .aiBoardView.flat()
        .every((c) => c === 'unknown'),
    ).toBe(true);
  });

  it('reveals a whole ship footprint as sunk once it goes down', () => {
    const game = readyGame();
    const destroyer = game.revealAiBoard().find((s) => s.name === 'Destroyer')!;

    for (const cell of cellsOf(destroyer)) {
      game.fireAtAi(cell);
      if (game.snapshot().phase !== 'over') game.takeAiTurn();
    }

    const view = game.snapshot().aiBoardView;
    for (const cell of cellsOf(destroyer)) {
      expect(view[cell.row][cell.col]).toBe('sunk');
    }
  });
});

describe('difficulty', () => {
  it('can be changed before the battle but not during it', () => {
    const game = new Game(1);
    game.setDifficulty('easy');
    expect(game.snapshot().difficulty).toBe('easy');

    game.randomisePlacement();
    game.startBattle();
    expect(() => game.setDifficulty('normal')).toThrow();
  });
});

describe('reproducibility', () => {
  it('the same seed produces the same AI fleet', () => {
    expect(JSON.stringify(new Game(2024).revealAiBoard())).toBe(
      JSON.stringify(new Game(2024).revealAiBoard()),
    );
  });

  it('the same seed and the same shots produce the same game', () => {
    const transcript = (seed: number) => {
      const game = readyGame(seed);
      playToCompletion(game);
      return JSON.stringify(game.snapshot().log);
    };
    expect(transcript(1234)).toBe(transcript(1234));
  });
});
