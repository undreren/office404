import type { GameMessage } from '../engine/Message'
import type { AgentJob, GameState, MainTabId } from '../types'
import type { AutomationAgentJob } from '../mechanics'
import type { HallucinationTrack } from '../prestige'
import {
  acceptLead,
  acceptSingularity,
  acknowledgeCompactionIntro,
  acknowledgeTabIntro,
  acknowledgeStoryIntro,
  acknowledgeTutorialStep,
  adjustRoleCount,
  advanceTime,
  applyOfflineProgress,
  buyAgentSlot,
  buyFineTune,
  buyGpuTick,
  buyVibingCourse,
  createInitialState,
  deliverProject,
  justMergePr,
  mergePr,
  prestigeHallucinationBuy,
  activateProductFeatureFromBacklog,
  rejectLead,
  resetGame,
  retire,
  selectTask,
  setMaxClientProjects,
  syncOfflineSpecialist,
  toggleSpecialistRole,
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
    apply: () => {
      const elapsedSec = Math.max(0, (at - saved.snapshotAt) / 1000)
      let next = { ...saved, snapshotAt: at }
      next = applyOfflineProgress(next, elapsedSec, at)
      return next
    },
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

export function toggleConductorMsg(at: number, projectId: string, enabled: boolean): GameMessage {
  return { at, apply: (state) => toggleConductor(state, projectId, enabled, at) }
}

export function buyAgentSlotMsg(at: number): GameMessage {
  return { at, apply: (state) => buyAgentSlot(state, at) }
}

export function buyGpuTickMsg(at: number): GameMessage {
  return { at, apply: (state) => buyGpuTick(state, at) }
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

export function prestigeHallucinationBuyMsg(at: number, track: HallucinationTrack): GameMessage {
  return { at, apply: (state) => prestigeHallucinationBuy(state, track, at) }
}

export function activateProductFeatureMsg(at: number, itemId: string): GameMessage {
  return { at, apply: (state) => activateProductFeatureFromBacklog(state, itemId, at) }
}

export function acceptSingularityMsg(at: number): GameMessage {
  return { at, apply: (state) => acceptSingularity(state, at) }
}

export function resetGameMsg(at: number, rngSeed?: number): GameMessage {
  return { at, apply: () => resetGame(at, rngSeed) }
}

export function acknowledgeTabIntroMsg(at: number, tab: MainTabId): GameMessage {
  return { at, apply: (state) => acknowledgeTabIntro(state, tab, at) }
}

export function acknowledgeStoryIntroMsg(at: number): GameMessage {
  return { at, apply: (state) => acknowledgeStoryIntro(state, at) }
}

export function acknowledgeTutorialStepMsg(at: number, step: number): GameMessage {
  return { at, apply: (state) => acknowledgeTutorialStep(state, step, at) }
}

export function toggleSpecialistRoleMsg(at: number, job: AutomationAgentJob, enabled: boolean): GameMessage {
  return { at, apply: (state) => toggleSpecialistRole(state, job, enabled, at) }
}

export function syncOfflineSpecialistMsg(at: number, tabHidden: boolean): GameMessage {
  return { at, apply: (state) => syncOfflineSpecialist(state, tabHidden, at) }
}

export function applyOfflineProgressMsg(at: number, elapsedSec: number): GameMessage {
  return { at, apply: (state) => applyOfflineProgress(state, elapsedSec, at) }
}

export function returnFromHiddenMsg(at: number, elapsedSec: number): GameMessage {
  return {
    at,
    apply: (state) => syncOfflineSpecialist(applyOfflineProgress(state, elapsedSec, at), false, at),
  }
}

export function setMaxClientProjectsMsg(at: number, slots: number): GameMessage {
  return { at, apply: (state) => setMaxClientProjects(state, slots, at) }
}

export function acknowledgeCompactionIntroMsg(at: number): GameMessage {
  return { at, apply: (state) => acknowledgeCompactionIntro(state, at) }
}

/** Returns true if the message changed state (for shop purchases). */
export function stateChanged(before: GameState, after: GameState): boolean {
  return before !== after && JSON.stringify(before) !== JSON.stringify(after)
}
