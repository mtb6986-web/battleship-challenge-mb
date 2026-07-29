/**
 * npm run selfplay [-- --games 1000 --seed 42]
 *
 * Prints the statistics table from SPEC.md Section 7. Reports actual numbers, not
 * pass/fail — the expected bands are printed alongside for reading, not enforcing.
 */
import { formatStats, runSelfPlay } from '../src/game/selfplay';
import type { Difficulty } from '../src/game/types';

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

const games = arg('games', 1000);
const seed = arg('seed', 42);

console.log(`Self-play harness — ${games} games per difficulty, seed ${seed}\n`);

const results = (['easy', 'normal'] as Difficulty[]).map((difficulty) => {
  const stats = runSelfPlay(difficulty, games, seed);
  console.log(formatStats(stats));
  console.log('');
  return stats;
});

const [easy, normal] = results;

console.log('Reference points');
console.log('  pure random guessing   ~95 shots');
console.log('  a cheater that sees the ships   17 shots exactly');
console.log('');
console.log('Expected bands (SPEC.md Section 7)');
console.log(`  Easy    90-100   ->  measured ${easy.averageShots.toFixed(1)}`);
console.log(`  Normal   45-65   ->  measured ${normal.averageShots.toFixed(1)}`);
console.log('');
console.log('  Above ~85 on Normal means the targeting logic is not working.');
console.log('  Below ~35 on Normal means the AI is reading the ship positions.');
console.log('  Both thresholds apply to this average only, never to a single game.');
console.log(`  Fastest single honest game in this run: ${normal.fastest} shots.`);
