/** Mulberry32 PRNG — seed lives in GameState for reproducible saves and tests. */
export type RngState = number

export function createRngSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]!
}

export function rngFloat(state: RngState): [number, RngState] {
  let t = (state + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, t]
}

export class Rng {
  state: RngState

  constructor(state: RngState) {
    this.state = state
  }

  float(): number {
    const [v, s] = rngFloat(this.state)
    this.state = s
    return v
  }

  int(min: number, max: number): number {
    return Math.floor(this.float() * (max - min + 1)) + min
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]!
  }

  chance(probability: number): boolean {
    return this.float() < probability
  }
}
