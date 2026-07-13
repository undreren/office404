import { SAVE_KEY } from '../game/constants'
import { repairStaleCodingAssignments } from '../game/projects'
import { createDefaultMeta } from '../game/meta'
import type { GameState, PersistedSave } from '../game/types'
import { MODEL_TIERS } from '../game/models'
import { createInitialState, syncAutomationAgents } from '../game/simulation/gameLogic'
import { ctxFrom } from '../game/simulation/simCtx'

const SAVE_VERSION = 11

function migrateTabIntros(seenTabIntros: string[]): GameState['seenTabIntros'] {
  const migrated = new Set<GameState['seenTabIntros'][number]>()
  for (const tab of seenTabIntros) {
    if (tab === 'feed' || tab === 'agents') {
      migrated.add('status')
    } else if (
      tab === 'status' ||
      tab === 'shop' ||
      tab === 'projects' ||
      tab === 'leads' ||
      tab === 'product' ||
      tab === 'hallucinations'
    ) {
      migrated.add(tab)
    }
  }
  return [...migrated]
}

function normalizeLoadedState(state: GameState): GameState {
  const ctx = ctxFrom(state)
  const synced = syncAutomationAgents(
    {
      ...state,
      seenTabIntros: migrateTabIntros(state.seenTabIntros as string[]),
      seenCompactionIntro: state.seenCompactionIntro ?? false,
      fineTuneTiers: state.fineTuneTiers ?? {},
      projects: repairStaleCodingAssignments(state.projects, state.agents),
    },
    ctx,
  )
  return synced
}

function migrateV7State(old: Record<string, unknown>): GameState {
  const at = (old.snapshotAt as number) ?? Date.now()
  const fresh = createInitialState(at, old.rng as number | undefined, createDefaultMeta(), {
    includeTutorial: !(old.tutorialDone as boolean),
  })
  return {
    ...fresh,
    ...old,
    meta: createDefaultMeta(),
    phase: 'playing',
    agentSlotPurchases: Math.max(0, ((old.agents as unknown[])?.length ?? 1) - 1),
    gpuTickPurchases: 0,
    mrr: 0,
    productFeaturesShipped: 0,
    productBacklog: [],
    vibingCourseTiers: {},
    fineTuneTiers: {},
    syntheticLeadCooldown: 4,
    taxCodeCooldown: 10,
    stats: {
      projectsCompleted: (old.stats as GameState['stats'])?.projectsCompleted ?? 0,
      tasksMerged: (old.stats as GameState['stats'])?.tasksMerged ?? 0,
      agentsDeployed: (old.stats as GameState['stats'])?.agentsDeployed ?? 1,
      compactionsSurvived: (old.stats as GameState['stats'])?.compactionsSurvived ?? 0,
      productsShipped: 0,
      syntheticLeadsAccepted: 0,
    },
  } as GameState
}

function migrateState(state: GameState, fromVersion: number): GameState {
  let next = state
  if (fromVersion < 5) {
    next = {
      ...next,
      acknowledgedTutorialStep: next.acknowledgedTutorialStep ?? -1,
      seenTabIntros: next.seenTabIntros ?? [],
    }
  }
  if (fromVersion < 6) {
    next = { ...next, seenStoryIntro: next.seenStoryIntro ?? true }
  }
  if (fromVersion < 8) {
    next = migrateV7State(next as unknown as Record<string, unknown>)
  }
  if (fromVersion < 9) {
    next = {
      ...next,
      seenTabIntros: migrateTabIntros(next.seenTabIntros as string[]),
      seenCompactionIntro: next.seenCompactionIntro ?? false,
    }
  }
  if (fromVersion < 10) {
    const { leadSpawnCooldown: _removed, ...rest } = next as GameState & { leadSpawnCooldown?: number }
    type LegacyLead = GameState['leads'][number] & { daysToExpire?: number }
    next = {
      ...rest,
      leads: (rest.leads as LegacyLead[])
        .filter((lead) => (lead.status as string) !== 'expired')
        .map(({ daysToExpire: _days, ...lead }) => lead),
    }
  }
  if (fromVersion < 11) {
    const fineTuneTiers = { ...next.fineTuneTiers }
    for (const id of next.purchasedFineTunes) {
      if (!fineTuneTiers[id]) {
        fineTuneTiers[id] = 1
      }
    }
    next = { ...next, fineTuneTiers }
  }
  return next
}

export function partializeSave(state: GameState): PersistedSave {
  return {
    version: SAVE_VERSION,
    meta: state.meta,
    state: {
      ...state,
      projects: repairStaleCodingAssignments(state.projects, state.agents),
    },
  }
}

export const SAVE_EXPORT_PREFIX = 'o404:v'

export function parsePersistedSave(raw: unknown): GameState | null {
  try {
    const parsed = raw as PersistedSave | { state?: GameState; version?: number }
    if ('meta' in parsed && parsed.state) {
      const version = parsed.version ?? SAVE_VERSION
      if (version > SAVE_VERSION) return null
      const state = version < SAVE_VERSION ? migrateState(parsed.state, version) : parsed.state
      return normalizeLoadedState({ ...state, meta: parsed.meta ?? createDefaultMeta() })
    }
    const legacy = parsed as { state?: GameState; version?: number }
    if (!legacy.state) return null
    const version = legacy.version ?? 6
    const migrated = migrateState(legacy.state, version)
    return normalizeLoadedState(migrated)
  } catch {
    return null
  }
}

export function encodeSaveExport(state: GameState): string {
  const json = JSON.stringify(partializeSave(state))
  const base64 = btoa(unescape(encodeURIComponent(json)))
  return `${SAVE_EXPORT_PREFIX}${SAVE_VERSION}:${base64}`
}

export function decodeSaveImport(code: string): GameState | null {
  const trimmed = code.trim()
  if (!trimmed) return null
  const payload = trimmed.startsWith(SAVE_EXPORT_PREFIX)
    ? trimmed.slice(SAVE_EXPORT_PREFIX.length).replace(/^\d+:/, '')
    : trimmed
  try {
    const json = decodeURIComponent(escape(atob(payload)))
    return parsePersistedSave(JSON.parse(json))
  } catch {
    return null
  }
}

export function loadPersistedState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return parsePersistedSave(JSON.parse(raw))
  } catch {
    return null
  }
}

export function savePersistedState(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(partializeSave(state)))
}

export function injectPersistedState(state: GameState): void {
  savePersistedState(state)
}

export { SAVE_VERSION, MODEL_TIERS }
