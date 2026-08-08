/**
 * Seeded, serializable PRNG (mulberry32).
 *
 * Every random decision in the simulation flows through one of these so that a
 * run is fully reproducible from its seed. That matters for two reasons:
 * tests can assert on exact outcomes, and a save file can restore the exact
 * random stream it was in the middle of.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Raw float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with empty array');
    return items[this.int(0, items.length - 1)];
  }

  /** Pick n distinct items (or all of them, if n exceeds the list). */
  sample<T>(items: readonly T[], n: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < n && pool.length > 0) {
      out.push(pool.splice(this.int(0, pool.length - 1), 1)[0]);
    }
    return out;
  }

  /** Box-Muller normal deviate. */
  normal(mean = 0, stdDev = 1): number {
    const u = Math.max(this.next(), Number.EPSILON);
    const v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Normal deviate clamped to +/- `limit` standard deviations. */
  clampedNormal(mean: number, stdDev: number, limit = 2.5): number {
    const raw = this.normal(0, 1);
    const clamped = Math.max(-limit, Math.min(limit, raw));
    return mean + clamped * stdDev;
  }

  getState(): number {
    return this.s;
  }

  static fromState(state: number): Rng {
    const rng = new Rng(0);
    rng.s = state >>> 0;
    return rng;
  }
}

/** Turn an arbitrary string into a 32-bit seed (for user-entered seeds). */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
