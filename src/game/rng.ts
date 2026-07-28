/**
 * Single seedable random source for the whole project.
 *
 * Nothing anywhere else may call Math.random(), or seeded reproducibility breaks.
 * mulberry32: small, fast, well-distributed enough for game placement.
 */
export class Rng {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array');
    return items[this.int(items.length)];
  }

  bool(): boolean {
    return this.next() < 0.5;
  }
}

export function randomSeed(): number {
  return Math.floor(Date.now() % 2147483647);
}
