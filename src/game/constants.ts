export const TICK_INTERVAL_MS = 1000
export const SAVE_KEY = 'office404-save-v3'
export const MAX_EVENTS = 50

/** 60 real seconds = 1 in-game day */
export const SECONDS_PER_GAME_DAY = 60

export const WIN_NET_WORTH = 10_000_000
export const LOSE_REPUTATION = 0

export const INITIAL_CASH = 120
export const INITIAL_TOKENS = 400
export const INITIAL_MAX_TOKENS = 2000
export const INITIAL_SANITY = 80
export const INITIAL_REPUTATION = 5
export const INITIAL_RAM = 8
export const INITIAL_GPU = 1
export const RENT_INTERVAL_DAYS = 30

export const SANITY_PASSIVE_DRAIN = 0.08
export const SANITY_SPRINT_DRAIN = 2.5
export const SANITY_VIBE_RESTORE = 3.5
export const SANITY_FORCED_VIBE_MULTIPLIER = 0.5
export const FORCED_VIBE_THRESHOLD = 1

export const SPRINT_SP_PER_DAY = 4.5
/** 0.5 game days = 30 real seconds */
export const PLAYER_ACTION_REVIEW_DAYS = 0.5
export const PLAYER_ACTION_REFINE_DAYS = 0.5
export const VIBE_MIN_DAYS = 1

export const QUALITY_BASE_HIT = 4
export const QUALITY_UNREFINED_MULT = 1.6
export const QUALITY_JUST_MERGE_MULT = 1.8
export const QUALITY_REVIEW_REDUCTION = 0.35
export const QUALITY_REFACTOR_PER_DAY = 12
export const QUALITY_REFACTOR_PRE_MERGE_MULT = 0.5

export const REFINE_SPLIT_RATIO = 0.8
export const REFINE_MIN_COMPLEXITY = 6

export const LATE_FEE_PERCENT = 0.15
export const LATE_REP_PENALTY_BASE = 3
export const EXPIRED_LEAD_REP_PENALTY = 2
export const ON_TIME_REP_BONUS = 4

export const TOKEN_PACK_COST = 60
export const TOKEN_PACK_AMOUNT = 500
export const EXTINGUISH_COST = 30
export const GPU_UPGRADE_COST = 250
export const GPU_SPEED_PER_LEVEL = 0.15
export const LOCAL_TICK_HARD_CAP = 1

export const LEAD_SPAWN_INTERVAL_DAYS = 4
export const MAX_ACTIVE_PROJECTS = 4
export const MAX_LEADS = 3

export const APARTMENT_CONFIG: Record<
  string,
  { rent: number; rackSlots: number; ramBonus: number; upgradeCost: number; label: string }
> = {
  cardboard: { rent: 40, rackSlots: 1, ramBonus: 0, upgradeCost: 0, label: 'Cardboard Box' },
  studio: { rent: 120, rackSlots: 2, ramBonus: 8, upgradeCost: 200, label: 'Studio Apartment' },
  loft: { rent: 280, rackSlots: 4, ramBonus: 24, upgradeCost: 600, label: 'Loft (STFU.io eligible)' },
  penthouse: { rent: 650, rackSlots: 8, ramBonus: 64, upgradeCost: 0, label: 'Penthouse CUDA Palace' },
}

export const RACK_CONFIG: Record<string, { cost: number; capacity: number; label: string }> = {
  mark_mini: { cost: 180, capacity: 1, label: 'Mark Mini' },
  mark_stfu: { cost: 520, capacity: 2, label: 'Mark STFU.io' },
  cuda_cluster: { cost: 1400, capacity: 4, label: 'CUDA Cluster' },
}

export const RACK_REFURBISH_VALUE: Record<string, number> = {
  mark_mini: 90,
  mark_stfu: 280,
  cuda_cluster: 900,
}
