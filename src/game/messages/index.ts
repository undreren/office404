import type { GameMessage } from '../engine/Message'
import type { AgentJob, GameState, MainTabId } from '../types'
import {
  acceptLead,
  acknowledgeTabIntro,
  acknowledgeTutorialStep,
  adjustCrewCap,
  adjustRoleCount,
  advanceTime,
  buyFineTune,
  buyGpuUpgrade,
  buyRamUpgrade,
  buyVibingCourse,
  createInitialState,
  deliverProject,
  justMergePr,
  mergePr,
  rejectLead,
  resetGame,
  retire,
  selectTask,
  toggleConductor,
  upgradeApartment,
  upgradeModelTier,
} from '../simulation/gameLogic'

export function timeElapsed(at: number, elapsedSec: number): GameMessage {
  return {
    at,
    apply: (state) => advanceTime(state, elapsedSec, at),
  }
}

export function newGame(at: number, rngSeed?: number): GameMessage {
  return {
    at,
    apply: () => createInitialState(at, rngSeed),
  }
}

export function hydrateFromSave(saved: GameState, at: number): GameMessage {
  return {
    at,
    apply: () => ({ ...saved, snapshotAt: at }),
  }
}

export function selectTaskMsg(at: number, taskId: string | null): GameMessage {
  return { at, apply: (state) => selectTask(state, taskId, at) }
}

export function mergePrMsg(at: number, taskId: string): GameMessage {
  return { at, apply: (state) => mergePr(state, taskId, at) }
}

export function justMergePrMsg(at: number, taskId: string): GameMessage {
  return { at, apply: (state) => justMergePr(state, taskId, at) }
}

export function acceptLeadMsg(at: number, leadId: string): GameMessage {
  return { at, apply: (state) => acceptLead(state, leadId, at) }
}

export function rejectLeadMsg(at: number, leadId: string): GameMessage {
  return { at, apply: (state) => rejectLead(state, leadId, at) }
}

export function deliverProjectMsg(at: number, projectId: string): GameMessage {
  return { at, apply: (state) => deliverProject(state, projectId, at) }
}

export function adjustRoleCountMsg(
  at: number,
  projectId: string,
  job: AgentJob,
  delta: number,
): GameMessage {
  return { at, apply: (state) => adjustRoleCount(state, projectId, job, delta, at) }
}

export function adjustCrewCapMsg(at: number, projectId: string, delta: number): GameMessage {
  return { at, apply: (state) => adjustCrewCap(state, projectId, delta, at) }
}

export function toggleConductorMsg(at: number, projectId: string, enabled: boolean): GameMessage {
  return { at, apply: (state) => toggleConductor(state, projectId, enabled, at) }
}

export function buyRamUpgradeMsg(at: number, upgradeId: string): GameMessage {
  return { at, apply: (state) => buyRamUpgrade(state, upgradeId, at) }
}

export function buyGpuUpgradeMsg(at: number, upgradeId: string): GameMessage {
  return { at, apply: (state) => buyGpuUpgrade(state, upgradeId, at) }
}

export function upgradeModelTierMsg(at: number): GameMessage {
  return { at, apply: (state) => upgradeModelTier(state, at) }
}

export function buyFineTuneMsg(at: number, fineTuneId: string): GameMessage {
  return { at, apply: (state) => buyFineTune(state, fineTuneId, at) }
}

export function buyVibingCourseMsg(at: number, courseId: string): GameMessage {
  return { at, apply: (state) => buyVibingCourse(state, courseId, at) }
}

export function upgradeApartmentMsg(at: number): GameMessage {
  return { at, apply: (state) => upgradeApartment(state, at) }
}

export function retireMsg(at: number): GameMessage {
  return { at, apply: (state) => retire(state, at) }
}

export function resetGameMsg(at: number, rngSeed?: number): GameMessage {
  return { at, apply: () => resetGame(at, rngSeed) }
}

export function acknowledgeTabIntroMsg(at: number, tab: MainTabId): GameMessage {
  return { at, apply: (state) => acknowledgeTabIntro(state, tab, at) }
}

export function acknowledgeTutorialStepMsg(at: number, step: number): GameMessage {
  return { at, apply: (state) => acknowledgeTutorialStep(state, step, at) }
}

/** Returns true if the message changed state (for shop purchases). */
export function stateChanged(before: GameState, after: GameState): boolean {
  return before !== after && JSON.stringify(before) !== JSON.stringify(after)
}
