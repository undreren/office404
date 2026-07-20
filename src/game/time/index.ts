export type { AdvanceTimeFn, AdvanceTimeResult } from './types'
export { syncChildAdvances, mergeAdvanceResults } from './syncChildren'
export {
  advanceGameStateStep,
  catchUpTo,
  advanceByRealSeconds,
  applyAdvanceStep,
} from './catchUp'
export { catchUpOffline } from './offlineCatchUp'
export { advanceSimulationDelta } from './simulation'
export { findNextBoundaryMs } from './nextBoundary'
export {
  advanceTime,
  negotiateStepBoundary,
  syncAgentAdvances,
  advanceAgentTime,
  advanceProjectTime,
  advanceCalendarTime,
  advanceLeadPipelineTime,
  timeToNextGameState,
  timeToNextAgent,
  timeToNextProject,
  timeToNextCalendar,
  timeToNextLeadPipeline,
} from './gameStateTime'
export {
  gameDayAt,
  gameSecElapsedAt,
  isCaughtUp,
  simSecForWallMs,
  wallMsForSimSec,
  TIME_NEVER,
  earliestAfter,
  stepBoundaryMs,
} from './timeMath'
