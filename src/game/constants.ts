/** Simulation tick interval — 30 Hz for fluid UI; pacing scales via deltaSec. */
export const TICK_INTERVAL_MS = 1000 / 30
export const SAVE_KEY = 'office404-save-v8'
export const MAX_EVENTS = 50

/** 60 real seconds = 1 in-game day */
export const SECONDS_PER_GAME_DAY = 60

export const LOSE_REPUTATION = 0

export const INITIAL_CASH = 0
export const INITIAL_REPUTATION = 0
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
export const ON_TIME_REP_BONUS = 4

/** Real seconds of active work at baseSpeed 1 to fill context before compacting. */
export const CONTEXT_FILL_SECONDS = 120

/** Real seconds to auto-compact and reset context after overflow (base; reducible via meta). */
export const COMPACT_DURATION_SEC = 30

/** Story points earned per tick per effective billion model parameters. */
export const SP_PROGRESS_PER_B_PARAM = 0.1

export const MIN_PROJECT_DAYS = 14
export const SP_PROGRESS_DAY_DIVISOR = 60

export const TUTORIAL_PAYMENT = 200

export const BASE_AGENT_SLOTS = 1
export const BASE_GPU_TICKS = 1

export const RAM_SLOT_BASE_COST = 80
export const RAM_SLOT_COST_MULT = 1.8
export const GPU_TICK_BASE_COST = 100
export const GPU_TICK_COST_MULT = 1.85

export const MAX_CLIENT_TASK_SP = 89
export const MRR_BASE_RATE = 8
export const IN_HOUSE_FIRST_FEATURE_COST = 50_000
export const PROCUREMENT_CASH_FRACTION = 0.1

export const PLATEAU_HOURS = 2
export const LADDER_BASE_CASH = 1_000_000
export const PRESTIGE_START_CASH = 200

export const REP_ZERO_PAY_MULT = 0.5
export const REP_ZERO_MAX_TASK_SP = 3

/** Max real seconds simulated when returning with the Offline Agent course. */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60
/** Ignore sub-threshold gaps so tab flips do not spam catch-up. */
export const MIN_OFFLINE_APPLY_SEC = 5
