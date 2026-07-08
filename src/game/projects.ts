import type { Lead, Project, Task } from './types'

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
    pendingQualityHit: 0,
    parentTaskId,
  }
}

export function createTutorialProject(): Project {
  const projectId = uid('proj')
  const tasks = [
    createTask(projectId, 'Fix login button', 8, 3),
    createTask(projectId, 'Add loading spinner', 6, 2),
    createTask(projectId, 'Update README', 4, 1),
  ]

  return {
    id: projectId,
    clientName: 'Friendly Neighbor App',
    blurb: 'Tutorial gig. Low stakes. Suspiciously generous.',
    payment: 220,
    durationDays: 20,
    daysRemaining: 20,
    quality: 88,
    totalStoryPoints: tasks.reduce((s, t) => s + t.storyPointsRequired, 0),
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

  const baseSp = randInt(12, 28)
  const storyPoints = Math.round(baseSp * (isUnreasonable ? 1.4 + repFactor * 0.1 : 1))
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
  const taskCount = Math.min(5, Math.max(2, Math.ceil(lead.totalStoryPoints / 8)))
  const spPerTask = Math.ceil(lead.totalStoryPoints / taskCount)
  const tasks: Task[] = []

  const usedTitles = new Set<string>()
  for (let i = 0; i < taskCount; i++) {
    let title = pick(TASK_TITLES)
    while (usedTitles.has(title)) title = pick(TASK_TITLES)
    usedTitles.add(title)

    const remaining = lead.totalStoryPoints - tasks.reduce((s, t) => s + t.storyPointsRequired, 0)
    const sp = i === taskCount - 1 ? remaining : spPerTask
    const complexity = Math.max(2, Math.round(sp / 3) + randInt(0, 3))
    tasks.push(createTask(projectId, title, sp, complexity))
  }

  return {
    id: projectId,
    clientName: lead.clientName,
    blurb: lead.blurb,
    payment: lead.payment,
    durationDays: lead.durationDays,
    daysRemaining: lead.durationDays,
    quality: 75,
    totalStoryPoints: lead.totalStoryPoints,
    status: 'active',
    tasks,
    isTutorial: false,
    lateCount: 0,
    repPenaltyMultiplier: 1 + lead.durationDays / 40,
  }
}

export function splitTask(task: Task): Task[] {
  const halfSp = Math.max(2, Math.round(task.storyPointsRequired * 0.8))
  const earnedEach = Math.round(task.storyPointsEarned * 0.5)
  const complexityEach = Math.max(2, Math.round(task.complexity * 0.8))

  return [
    {
      ...createTask(task.projectId, `${task.title} (A)`, halfSp, complexityEach, task.id),
      storyPointsEarned: earnedEach,
      refined: true,
    },
    {
      ...createTask(task.projectId, `${task.title} (B)`, halfSp, complexityEach, task.id),
      storyPointsEarned: earnedEach,
      refined: true,
    },
  ]
}
