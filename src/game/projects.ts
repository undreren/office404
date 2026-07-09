import type { Lead, Project, Task } from './types'
import { TUTORIAL_PAYMENT } from './constants'
import { FIBONACCI, fibIndex, pickLeadFibonacci } from './mechanics'

const CLIENTS = [
  'Nexus Dynamics',
  'PivotPal',
  'StealthStartup.io',
  'MegaCorp Subsidiary',
  'Dave\'s Enterprise Solutions',
  'Blockchain For Dogs',
  'The Other Uber',
  'CloudSync (not that one)',
]

const BLURBS = [
  'Rebuild the dashboard but make it "pop".',
  'AI-powered spreadsheet. Yes, another one.',
  'Migrate our monolith to microservices by Friday.',
  'Add blockchain. We don\'t know why either.',
  'Fix the bug that only happens on the CEO\'s laptop.',
  'Implement Web3 login. Wallet optional, panic required.',
  'Refactor legacy PHP. The legacy is emotional.',
  'Make the app 10x faster without changing anything.',
]

const TASK_TITLES = [
  'Fix auth redirect loop',
  'Add dark mode (critical)',
  'Write unit tests (lol)',
  'Migrate database schema',
  'Implement webhook handler',
  'Debug production-only bug',
  'Add rate limiting',
  'Refactor god object',
  'Update API documentation',
  'Fix mobile layout',
  'Add logging',
  'Optimize N+1 queries',
  'Implement caching layer',
  'Add error boundaries',
  'Ship feature flag system',
]

let idCounter = 0
function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now()}-${idCounter}`
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function createTask(
  projectId: string,
  title: string,
  storyPoints: number,
  complexity: number,
  parentTaskId: string | null = null,
): Task {
  return {
    id: uid('task'),
    projectId,
    title,
    storyPointsRequired: storyPoints,
    storyPointsEarned: 0,
    complexity,
    refined: false,
    status: 'open',
    assignedAgentId: null,
    completedByAgentId: null,
    pendingQualityHit: 0,
    parentTaskId,
  }
}

export function createTutorialProject(): Project {
  const projectId = uid('proj')
  const sp = 5
  const tasks = [createTask(projectId, 'Fix login button', sp, fibIndex(sp))]

  return {
    id: projectId,
    clientName: 'Friendly Neighbor App',
    blurb: 'Tutorial gig. One ticket. Suspiciously the only cash you have.',
    payment: TUTORIAL_PAYMENT,
    durationDays: 20,
    daysRemaining: 20,
    quality: 88,
    totalStoryPoints: sp,
    status: 'active',
    tasks,
    isTutorial: true,
    lateCount: 0,
    repPenaltyMultiplier: 1,
  }
}

export function generateLead(reputation: number): Lead {
  const repFactor = Math.max(1, reputation / 10)
  const isUnreasonable = reputation > 25

  const storyPoints = pickLeadFibonacci(reputation)
  const durationDays = Math.max(
    8,
    Math.round((isUnreasonable ? randInt(10, 18) : randInt(15, 35)) / repFactor),
  )
  const payment = Math.round(
    (storyPoints * (4 + reputation * 0.3)) * (isUnreasonable ? 0.75 : 1),
  )

  return {
    id: uid('lead'),
    clientName: pick(CLIENTS),
    blurb: pick(BLURBS),
    payment,
    durationDays,
    totalStoryPoints: storyPoints,
    daysToExpire: randInt(3, 8),
    status: 'available',
    repRequired: Math.max(0, randInt(0, Math.floor(reputation * 0.6))),
  }
}

export function createProjectFromLead(lead: Lead): Project {
  const projectId = uid('proj')
  const sp = lead.totalStoryPoints
  const tasks = [createTask(projectId, pick(TASK_TITLES), sp, fibIndex(sp))]

  return {
    id: projectId,
    clientName: lead.clientName,
    blurb: lead.blurb,
    payment: lead.payment,
    durationDays: lead.durationDays,
    daysRemaining: lead.durationDays,
    quality: 75,
    totalStoryPoints: sp,
    status: 'active',
    tasks,
    isTutorial: false,
    lateCount: 0,
    repPenaltyMultiplier: 1 + lead.durationDays / 40,
  }
}

export function splitTask(task: Task): Task[] {
  const sp = task.storyPointsRequired
  const idx = fibIndex(sp)
  if (idx < 2) {
    throw new Error(`Cannot refine ${sp} SP task`)
  }

  const spA = FIBONACCI[idx - 1]
  const spB = FIBONACCI[idx - 2]
  const earnedA = Math.floor(task.storyPointsEarned / 2)
  const earnedB = task.storyPointsEarned - earnedA

  return [
    {
      ...createTask(task.projectId, `${task.title} (A)`, spA, fibIndex(spA), task.id),
      storyPointsEarned: earnedA,
      refined: true,
    },
    {
      ...createTask(task.projectId, `${task.title} (B)`, spB, fibIndex(spB), task.id),
      storyPointsEarned: earnedB,
      refined: true,
    },
  ]
}
