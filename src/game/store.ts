import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentJob, GameState } from './types'
import { SAVE_KEY } from './constants'
import { createRngSeed } from './rng'
import {
  acceptLead,
  adjustCrewCap,
  adjustRoleCount,
  advanceTime,
  agentCapacity,
  buyFineTune,
  buyGpuUpgrade,
  buyRamUpgrade,
  buyVibingCourse,
  createInitialState,
  deliverProject,
  fineTuneId,
  getModelTier,
  getNetWorth,
  getNextApartment,
  isReadyToDeliver,
  justMergePr,
  mergePr,
  MODEL_TIERS,
  modelSpPerTick,
  canStaffAdditionalAgent,
  projectProgressPct,
  rejectLead,
  resetGame,
  retire,
  selectTask,
  toggleConductor,
  upgradeApartment,
  upgradeModelTier,
} from './simulation/gameLogic'

export interface GameActions {
  tick: (deltaSec: number) => void
  selectTask: (taskId: string | null) => void
  mergePr: (taskId: string) => void
  justMergePr: (taskId: string) => void
  acceptLead: (leadId: string) => void
  rejectLead: (leadId: string) => void
  deliverProject: (projectId: string) => void
  adjustRoleCount: (projectId: string, job: AgentJob, delta: number) => void
  adjustCrewCap: (projectId: string, delta: number) => void
  toggleConductor: (projectId: string, enabled: boolean) => void
  buyRamUpgrade: (upgradeId: string) => boolean
  buyGpuUpgrade: (upgradeId: string) => boolean
  upgradeModelTier: () => boolean
  buyFineTune: (fineTuneId: string) => boolean
  buyVibingCourse: (courseId: string) => boolean
  upgradeApartment: () => boolean
  retire: () => void
  resetGame: () => void
}

export type GameStore = GameState & GameActions

function now(): number {
  return Date.now()
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const initial = createInitialState(now(), createRngSeed())

      return {
        ...initial,

        tick(deltaSec: number) {
          set(advanceTime(get(), deltaSec, now()))
        },

        selectTask(taskId) {
          set(selectTask(get(), taskId, now()))
        },

        mergePr(taskId) {
          set(mergePr(get(), taskId, now()))
        },

        justMergePr(taskId) {
          set(justMergePr(get(), taskId, now()))
        },

        acceptLead(leadId) {
          set(acceptLead(get(), leadId, now()))
        },

        rejectLead(leadId) {
          set(rejectLead(get(), leadId, now()))
        },

        deliverProject(projectId) {
          set(deliverProject(get(), projectId, now()))
        },

        adjustRoleCount(projectId, job, delta) {
          set(adjustRoleCount(get(), projectId, job, delta, now()))
        },

        adjustCrewCap(projectId, delta) {
          set(adjustCrewCap(get(), projectId, delta, now()))
        },

        toggleConductor(projectId, enabled) {
          set(toggleConductor(get(), projectId, enabled, now()))
        },

        buyRamUpgrade(upgradeId) {
          const before = get()
          const after = buyRamUpgrade(before, upgradeId, now())
          if (after === before) return false
          set(after)
          return true
        },

        buyGpuUpgrade(upgradeId) {
          const before = get()
          const after = buyGpuUpgrade(before, upgradeId, now())
          if (after === before) return false
          set(after)
          return true
        },

        upgradeModelTier() {
          const before = get()
          const after = upgradeModelTier(before, now())
          if (after === before) return false
          set(after)
          return true
        },

        buyFineTune(fineTuneIdArg) {
          const before = get()
          const after = buyFineTune(before, fineTuneIdArg, now())
          if (after === before) return false
          set(after)
          return true
        },

        buyVibingCourse(courseId) {
          const before = get()
          const after = buyVibingCourse(before, courseId, now())
          if (after === before) return false
          set(after)
          return true
        },

        upgradeApartment() {
          const before = get()
          const after = upgradeApartment(before, now())
          if (after === before) return false
          set(after)
          return true
        },

        retire() {
          set(retire(get(), now()))
        },

        resetGame() {
          set(resetGame(now(), createRngSeed()))
        },
      }
    },
    {
      name: SAVE_KEY,
      version: 4,
      migrate: () => createInitialState(now(), createRngSeed()) as unknown as GameStore,
      partialize: (state) => ({
        phase: state.phase,
        cash: state.cash,
        reputation: state.reputation,
        gameDay: state.gameDay,
        rentDueInDays: state.rentDueInDays,
        apartment: state.apartment,
        apartmentLeaseRemaining: state.apartmentLeaseRemaining,
        totalRam: state.totalRam,
        totalGpus: state.totalGpus,
        modelTierIndex: state.modelTierIndex,
        purchasedRamUpgrades: state.purchasedRamUpgrades,
        purchasedGpuUpgrades: state.purchasedGpuUpgrades,
        purchasedFineTunes: state.purchasedFineTunes,
        vibingCourses: state.vibingCourses,
        agents: state.agents,
        projects: state.projects,
        leads: state.leads,
        selectedTaskId: state.selectedTaskId,
        tutorialDone: state.tutorialDone,
        leadSpawnCooldown: state.leadSpawnCooldown,
        events: state.events,
        stats: state.stats,
        snapshotAt: state.snapshotAt,
        rng: state.rng,
        nextId: state.nextId,
      }),
    },
  ),
)

export {
  agentCapacity,
  canStaffAdditionalAgent,
  fineTuneId,
  getModelTier,
  getNetWorth,
  getNextApartment,
  isReadyToDeliver,
  MODEL_TIERS,
  modelSpPerTick,
  projectProgressPct,
}
