import { isReadyToDeliver } from './selectors'
import type { GameState, MainTabId } from './types'

export type TutorialStep = 0 | 1 | 2 | 3

export const TUTORIAL_STEP_COUNT = 4

export function getTutorialStep(state: GameState): TutorialStep | null {
  if (state.tutorialDone) return null
  const tutorial = state.projects.find((p) => p.isTutorial && p.status === 'active')
  if (!tutorial) return null

  const hasOpenRequirements = tutorial.requirements.some((r) => r.status === 'open')
  if (hasOpenRequirements) return 0

  const coderAssigned =
    tutorial.roleCounts.code > 0 ||
    state.agents.some((a) => a.projectId === tutorial.id && a.job === 'code')
  if (!coderAssigned) return 1

  if (!isReadyToDeliver(tutorial)) return 2

  return 3
}

export const TAB_INTRO_COPY: Record<
  MainTabId,
  { title: string; body: string }
> = {
  feed: {
    title: 'Incident Feed',
    body: 'Everything that goes wrong (or occasionally right) shows up here — rent, leads, merges, meltdowns. Check it when you need the story so far.',
  },
  shop: {
    title: 'Shop',
    body: 'Upgrade housing to unlock hardware tiers, buy RAM and GPUs, fine-tune models, and take vibing courses. Cash is real. Regret is optional.',
  },
  agents: {
    title: 'Agents',
    body: 'Your deployed AI workforce. Each agent has a job on a project. They work automatically once staffed — you manage headcount, not keystrokes.',
  },
  projects: {
    title: 'Projects',
    body: 'Active client work. Requirements refine into tasks, agents push them through code → review → QA, then you deliver for payment. Miss deadlines at your own peril.',
  },
  leads: {
    title: 'Leads',
    body: 'New business opportunities. Accept to add a project, reject to stay sane, or ignore until they expire and your reputation takes a hit.',
  },
}

export const TUTORIAL_STEP_COPY: Record<TutorialStep, { title: string; body: string }> = {
  0: {
    title: 'Step 1 — Refining',
    body: 'Your agent is refining requirements into tasks. This happens automatically — no clicks needed. Time still passes: one real minute equals one in-game day.',
  },
  1: {
    title: 'Step 2 — Staff a coder',
    body: 'Tasks are ready. Tap + next to Code under Staffing to assign a coder. Agents only work roles you staff.',
  },
  2: {
    title: 'Step 3 — Let agents work',
    body: 'Watch tasks move through coding, review, and QA. Staff reviewers and testers the same way if progress stalls. Quality affects payment and reputation.',
  },
  3: {
    title: 'Step 4 — Deliver',
    body: 'When every task is merged and QA is complete, hit Deliver to ship the tutorial project and collect your first payment. Leads unlock after this.',
  },
}
