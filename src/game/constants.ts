export const TICK_INTERVAL_MS = 1000
export const SAVE_KEY = 'office404-save-v5'
export const MAX_EVENTS = 50

/** 60 real seconds = 1 in-game day */
export const SECONDS_PER_GAME_DAY = 60

export const WIN_NET_WORTH = 10_000_000
export const LOSE_REPUTATION = 0

export const INITIAL_CASH = 0
export const INITIAL_TOKENS = 0
export const INITIAL_MAX_TOKENS = 2000
export const INITIAL_SANITY = 80
export const INITIAL_REPUTATION = 5
export const RENT_INTERVAL_DAYS = 30

export const SANITY_PASSIVE_DRAIN = 0.08
export const SANITY_VIBE_RESTORE = 5
export const SANITY_FORCED_VIBE_MULTIPLIER = 0.5
export const FORCED_VIBE_THRESHOLD = 1

export const PLAYER_ACTION_BASE_DAYS = 0.5
export const VIBE_MIN_DAYS = 1

export const QUALITY_BASE_HIT = 8
export const QUALITY_REFACTOR_PER_DAY = 12
/** Local 4B is the baseline for refine/refactor speed. */
export const AGENT_SKILL_REFERENCE_PARAMS = 4

/** Review finishes in this fraction of expected coding time on the same ticket. */
export const REVIEW_CODE_TIME_FRACTION = 0.5

/** Refine jobs complete this many times faster than code/review. */
export const REFINE_SPEED_MULTIPLIER = 10

/** Test jobs complete this many times faster than code. */
export const TEST_SPEED_MULTIPLIER = 5

/** QA success rate uses this SP reference instead of full project scope. */
export const TEST_DIFFICULTY_SP = 5

/** Story points per review comment fixup task. */
export const REVIEW_COMMENT_SP = 0.5

/** Each resolved review comment shaves this fraction off the PR's quality hit. */
export const REVIEW_COMMENT_REDUCTION_FRACTION = 0.2

/** Max fraction of a PR's quality hit that comments can eliminate. */
export const REVIEW_COMMENT_REDUCTION_CAP = 0.5

/** Smallest SP ticket that can still be refined (1 → 0.5+0.5). */
export const REFINE_MIN_STORY_POINTS = 1
/** Smallest leaf ticket after refinement. */
export const MIN_STORY_POINTS = 0.5

export const LATE_FEE_PERCENT = 0.15
export const LATE_REP_PENALTY_BASE = 3
export const EXPIRED_LEAD_REP_PENALTY = 2
export const ON_TIME_REP_BONUS = 4

/** Base probability a merge introduces a hidden bug before QA. */
export const BUG_CHANCE_BASE = 0.35
/** Reputation hit per undiscovered bug shipped to the client. */
export const BUG_SHIPPED_REP_PENALTY = 5
/** Sanity hit per undiscovered bug the client finds. */
export const BUG_SHIPPED_SANITY_PENALTY = 8
/** Payment clawback fraction per undiscovered bug shipped. */
export const BUG_SHIPPED_PAYMENT_PENALTY = 0.12
/** Chance per SP of QA work that a hidden bug is found. */
export const BUG_DISCOVERY_RATE = 0.22

export const TOKEN_PACK_COST = 60
export const TOKEN_PACK_AMOUNT = 500
export const EXTINGUISH_COST = 30
export const LOCAL_TICK_HARD_CAP = 1

/** Real seconds to auto-compact and reset context after overflow. */
export const COMPACT_DURATION_SEC = 10

export const LEAD_SPAWN_INTERVAL_DAYS = 4
export const MAX_ACTIVE_PROJECTS = 4
export const MAX_LEADS = 3

export const TUTORIAL_PAYMENT = 200

export const APARTMENT_CONFIG: Record<
  string,
  { rent: number; rackSlots: number; upgradeCost: number; label: string }
> = {
  cardboard: { rent: 40, rackSlots: 1, upgradeCost: 0, label: 'Cardboard Box' },
  studio: { rent: 120, rackSlots: 2, upgradeCost: 200, label: 'Studio Apartment' },
  loft: { rent: 280, rackSlots: 4, upgradeCost: 600, label: 'Loft (STFU.io eligible)' },
  penthouse: { rent: 650, rackSlots: 8, upgradeCost: 0, label: 'Penthouse CUDA Palace' },
}

export const RACK_CONFIG: Record<string, { cost: number; ram: number; gpus: number; label: string }> = {
  mark_mini: { cost: 180, ram: 8, gpus: 2, label: 'Mark Mini' },
  mark_stfu: { cost: 520, ram: 16, gpus: 4, label: 'Mark STFU.io' },
  cuda_cluster: { cost: 1400, ram: 32, gpus: 8, label: 'CUDA Cluster' },
}

export const RACK_REFURBISH_VALUE: Record<string, number> = {
  mark_mini: 90,
  mark_stfu: 280,
  cuda_cluster: 900,
}
