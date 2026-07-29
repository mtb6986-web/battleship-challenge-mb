import { TOTAL_SHIP_CELLS } from './types';
import type { Difficulty } from './types';
import { coordKey, inBounds, randomFleet, resolveShot, validateFleet } from './board';
import { Rng } from './rng';
import { createOpponent } from './ai';

export interface SelfPlayStats {
  readonly difficulty: Difficulty;
  readonly games: number;
  readonly completed: number;
  readonly unfinished: number;
  readonly over100Shots: number;
  readonly wrongHitCount: number;
  readonly illegalShots: number;
  readonly illegalFleets: number;
  readonly averageShots: number;
  readonly fastest: number;
  readonly slowest: number;
}

const SHOT_CEILING = 200; // hard stop so a broken AI fails loudly instead of hanging

/**
 * Plays one AI against a randomly-placed fleet with no UI. The AI is given the
 * fleet only as an opponent to shoot at; it never receives the ship positions.
 */
export function runSelfPlay(difficulty: Difficulty, games: number, seed: number): SelfPlayStats {
  const rng = new Rng(seed);
  const shotCounts: number[] = [];
  let unfinished = 0;
  let over100Shots = 0;
  let wrongHitCount = 0;
  let illegalShots = 0;
  let illegalFleets = 0;

  for (let game = 0; game < games; game += 1) {
    let ships = randomFleet(rng);
    if (validateFleet(ships) !== null) illegalFleets += 1;

    const opponent = createOpponent(difficulty, rng);
    const fired = new Set<string>();
    let hits = 0;
    let shots = 0;
    let finished = false;

    while (shots < SHOT_CEILING) {
      let coord;
      try {
        coord = opponent.nextShot();
      } catch {
        illegalShots += 1;
        break;
      }

      if (!inBounds(coord) || fired.has(coordKey(coord))) illegalShots += 1;
      fired.add(coordKey(coord));
      shots += 1;

      const outcome = resolveShot(ships, coord);
      ships = outcome.ships;
      opponent.observe(outcome.result);
      if (outcome.result.outcome !== 'miss') hits += 1;

      if (outcome.result.fleetDestroyed) {
        finished = true;
        break;
      }
    }

    if (!finished) {
      unfinished += 1;
      continue;
    }
    if (shots > 100) over100Shots += 1;
    if (hits !== TOTAL_SHIP_CELLS) wrongHitCount += 1;
    shotCounts.push(shots);
  }

  const total = shotCounts.reduce((sum, n) => sum + n, 0);
  return {
    difficulty,
    games,
    completed: shotCounts.length,
    unfinished,
    over100Shots,
    wrongHitCount,
    illegalShots,
    illegalFleets,
    averageShots: shotCounts.length > 0 ? total / shotCounts.length : 0,
    fastest: shotCounts.length > 0 ? Math.min(...shotCounts) : 0,
    slowest: shotCounts.length > 0 ? Math.max(...shotCounts) : 0,
  };
}

export function formatStats(stats: SelfPlayStats): string {
  const rows: [string, string][] = [
    ['Games completed', String(stats.completed)],
    ['Crashes, hangs, or unfinished games', String(stats.unfinished)],
    ['Games exceeding 100 shots', String(stats.over100Shots)],
    ["Games where the loser's hit count != 17", String(stats.wrongHitCount)],
    ['Illegal shots (repeat or off-board)', String(stats.illegalShots)],
    ['Illegal fleets generated', String(stats.illegalFleets)],
    ['Average shots to win', stats.averageShots.toFixed(1)],
    ['Fastest win', String(stats.fastest)],
    ['Slowest win', String(stats.slowest)],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));
  const header = `--- ${stats.difficulty.toUpperCase()} (${stats.games} games) ---`;
  const body = rows.map(([label, value]) => `  ${label.padEnd(width)}  ${value}`).join('\n');
  return `${header}\n${body}`;
}
