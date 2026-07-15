import { isReadyToDeliver } from './selectors'
import type { GameState, MainTabId } from './types'

export type TutorialStep = 0 | 1 | 2 | 3

export const TUTORIAL_STEP_COUNT = 4

export const STORY_INTRO_COPY = {
  title: 'Welcome to Office 404',
  body: `The Singularity happened on a Tuesday. Nobody noticed — the models were busy hallucinating a better Tuesday.

You woke up with a cardboard box for an office, one agent slot, and a freelance LLC called Office 404 (Intelligence Not Found; invoices very much found). Your uncle swears the tutorial gig is "exposure." Your AI agents burn tokens you can't afford, compact their brains mid-sentence, and somehow still ship faster than you.

Clients want "AI-powered synergy" yesterday. Rent wants $40 tomorrow. Ship Uncle's neighbor app, unlock real leads, climb the housing ladder, and retire for hallucination points — prestige currency for upgrades that were never in the roadmap.

No pressure. Infinite audacity.`,
}

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
  status: {
    title: 'Status',
    body: 'Your deployed agents and the incident log live here. Watch context % on each agent — when it hits 100%, they compact (reboot) and sit idle until their brain defrags. Everything else that goes wrong (or occasionally right) shows up in the log below.',
  },
  shop: {
    title: 'Shop',
    body: 'Upgrade housing to unlock agent slots and GPU ticks, buy fine-tunes, and take vibing courses. Model tiers come from Hallucinations — retirement grants points.',
  },
  projects: {
    title: 'Projects',
    body: 'Your client pipeline in columns. Each column holds an incoming lead or active project — accept in place, ship when ready, and the column refills with the next lead.',
  },
  product: {
    title: 'Product',
    body: 'In-house features that print MRR. Unlocked via hallucinations after you have suffered enough client work.',
  },
  hallucinations: {
    title: 'Hallucinations',
    body: 'Prestige shop. Retire at the cash threshold to earn points, then spend them on model tiers, context, automation agents, and other crimes against the backlog.',
  },
}

export const COMPACTION_INTRO_COPY = {
  title: 'Context compaction',
  body: `An agent's context window filled up — their working memory hit the ceiling and the runtime pulled the plug. They drop their current task, go idle for ~30 seconds while context drains, then reboot with a clean slate and pick work back up.

Watch the context % on the Status roster. Prestige upgrades can shrink downtime. Until then: compaction is a feature, not a bug. Probably.`,
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
    body: 'When every task is merged and QA is complete, hit Deliver to ship the tutorial project and collect your first payment. Your first client lead appears in the same column.',
  },
}
