import type { GameState } from '../types'

export class IdAllocator {
  nextId: number

  constructor(nextId: number) {
    this.nextId = nextId
  }

  allocate(prefix: string): string {
    const id = `${prefix}-${this.nextId}`
    this.nextId += 1
    return id
  }
}

export function applyIdAllocator(state: GameState, allocator: IdAllocator): GameState {
  return { ...state, nextId: allocator.nextId }
}
