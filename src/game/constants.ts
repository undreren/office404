export const TICK_INTERVAL_MS = 1000
export const SAVE_KEY = 'office404-save-v7'
export const MAX_EVENTS = 50

/** 60 real seconds = 1 in-game day */
export const SECONDS_PER_GAME_DAY = 60

export const WIN_CASH = 10_000_000
export const LOSE_REPUTATION = 0

export const INITIAL_CASH = 0
export const INITIAL_REPUTATION = 5
export const RENT_INTERVAL_DAYS = 30

export const PLAYER_ACTION_BASE_DAYS = 0.5

/** Local 4B is the baseline for refine speed. */
export const AGENT_SKILL_REFERENCE_PARAMS = 4

export const REVIEW_CODE_TIME_FRACTION = 0.5
export const REFINE_SPEED_MULTIPLIER = 10
export const TEST_SPEED_MULTIPLIER = 5
export const REVIEW_COMMENT_SP = 0.5
export const PR_QUALITY_PER_COMMENT = 10
export const JUST_MERGE_PR_QUALITY = 20
export const PROMPT_ENGINEERING_PR_BOOST = 15

export const LATE_FEE_PERCENT = 0.15
export const LATE_REP_PENALTY_BASE = 3
export const EXPIRED_LEAD_REP_PENALTY = 2
export const ON_TIME_REP_BONUS = 4

/** Real seconds to auto-compact and reset context after overflow. */
export const COMPACT_DURATION_SEC = 30

/** Story points earned per tick per billion model parameters. */
export const SP_PROGRESS_PER_B_PARAM = 0.1

export const LEAD_SPAWN_INTERVAL_DAYS = 4
/** Floor for reputation- and time-accelerated lead cadence. */
export const LEAD_SPAWN_INTERVAL_MIN_DAYS = 1.5
export const MAX_ACTIVE_PROJECTS = 4
export const MAX_LEADS = 3
/** Minimum project deadline after wait-time penalties. */
export const MIN_PROJECT_DAYS = 5
/** gameDay divisor inside the polynomial SP/day growth curve. */
export const SP_PROGRESS_DAY_DIVISOR = 60

export const TUTORIAL_PAYMENT = 200

/** Laptop baseline — always owned. */
export const BASE_RAM_GB = 2
export const BASE_GPU = 1

export const APARTMENT_CONFIG: Record<
  string,
  { rent: number; hardwareUnlockTier: number; upgradeCost: number; label: string }
> = {
  cardboard: { rent: 40, hardwareUnlockTier: 1, upgradeCost: 0, label: 'Cardboard Box' },
  shared_1br: { rent: 80, hardwareUnlockTier: 2, upgradeCost: 100, label: 'Shared 1BR' },
  studio: { rent: 120, hardwareUnlockTier: 3, upgradeCost: 200, label: 'Studio Apartment' },
  loft: { rent: 280, hardwareUnlockTier: 4, upgradeCost: 600, label: 'Loft (STFU.io eligible)' },
  penthouse: { rent: 650, hardwareUnlockTier: 5, upgradeCost: 0, label: 'Penthouse CUDA Palace' },
}
