import type { Lead, Project, Requirement, Task } from './types'
import { MIN_STORY_POINTS, REFINE_MIN_STORY_POINTS, TUTORIAL_PAYMENT } from './constants'
import { FIBONACCI, fibIndex, isFibonacci, pickLeadFibonacci } from './mechanics'

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

const REQUIREMENT_TITLES = [
  'Users must be able to log in',
  'Dashboard needs to not look like 2009',
  'API must return JSON sometimes',
  'Mobile layout cannot be a war crime',
  'Admin panel with god-mode toggles',
  'Webhooks that actually fire',
  'Rate limiting for the one angry user',
  'Dark mode (legally mandated)',
  'Error messages humans can parse',
  'Caching layer because DB cried',
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

export function createRequirement(
  projectId: string,
  title: string,
  storyPoints: number,
): Requirement {
  return {
    id: uid('req'),
    projectId,
    title,
    storyPoints,
    status: 'open',
  }
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
    revealedQualityHit: null,
    parentTaskId,
    hasUndiscoveredBug: false,
    bugDiscovered: false,
    isBugFix: false,
    sourceTaskId: null,
  }
}

function createRequirementsForProject(projectId: string, totalSp: number): Requirement[] {
  const idx = fibIndex(totalSp)
  if (idx <= 1 || totalSp <= 3) {
    return [createRequirement(projectId, pick(REQUIREMENT_TITLES), totalSp)]
  }

  const spA = FIBONACCI[idx - 1]
  const spB = totalSp - spA
  const titles = [...REQUIREMENT_TITLES]
  const titleA = pick(titles)
  const titleB = pick(titles.filter((t) => t !== titleA))
  return [
    createRequirement(projectId, titleA, spA),
    createRequirement(projectId, titleB, spB),
  ]
}

export function createTutorialProject(): Project {
  const projectId = uid('proj')
  const sp = 5

  return {
    id: projectId,
    clientName: 'Friendly Neighbor App',
    blurb: 'Tutorial gig. One requirement. Refine it into work before anyone codes.',
    payment: TUTORIAL_PAYMENT,
    durationDays: 20,
    daysRemaining: 20,
    quality: 88,
    testPercent: 0,
    testStoryPointsRequired: 0,
    testStoryPointsCompleted: 0,
    totalStoryPoints: sp,
    status: 'active',
    requirements: [createRequirement(projectId, 'Users must be able to log in', sp)],
    tasks: [],
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

  return {
    id: projectId,
    clientName: lead.clientName,
    blurb: lead.blurb,
    payment: lead.payment,
    durationDays: lead.durationDays,
    daysRemaining: lead.durationDays,
    quality: 75,
    testPercent: 0,
    testStoryPointsRequired: 0,
    testStoryPointsCompleted: 0,
    totalStoryPoints: sp,
    status: 'active',
    requirements: createRequirementsForProject(projectId, sp),
    tasks: [],
    isTutorial: false,
    lateCount: 0,
    repPenaltyMultiplier: 1 + lead.durationDays / 40,
  }
}

export function canRefineRequirement(requirement: Requirement): boolean {
  return requirement.status === 'open'
}

/** Leaf tickets (0.5 SP) are done refining; larger tickets can always be split further. */
export function isRefineLeaf(sp: number): boolean {
  return sp < REFINE_MIN_STORY_POINTS
}

export function canRefineTask(task: Task): boolean {
  return (
    !isRefineLeaf(task.storyPointsRequired) &&
    isFibonacci(task.storyPointsRequired) &&
    task.status !== 'merged' &&
    task.status !== 'pr_ready' &&
    task.status !== 'done'
  )
}

export function requirementToTask(requirement: Requirement): Task {
  const sp = requirement.storyPoints
  return {
    ...createTask(requirement.projectId, requirement.title, sp, fibIndex(sp)),
    refined: isRefineLeaf(sp),
  }
}

export function splitTask(task: Task): Task[] {
  const sp = task.storyPointsRequired
  const idx = fibIndex(sp)
  if (idx < 1) {
    throw new Error(`Cannot refine ${sp} SP task (minimum leaf is ${MIN_STORY_POINTS} SP)`)
  }

  const spA = FIBONACCI[idx - 1]
  const spB = sp - spA
  const earnedA = Math.min(spA, Math.round(task.storyPointsEarned * (spA / sp) * 2) / 2)
  const earnedB = task.storyPointsEarned - earnedA

  return [
    {
      ...createTask(task.projectId, `${task.title} (A)`, spA, fibIndex(spA), task.id),
      storyPointsEarned: earnedA,
      refined: isRefineLeaf(spA),
    },
    {
      ...createTask(task.projectId, `${task.title} (B)`, spB, fibIndex(spB), task.id),
      storyPointsEarned: earnedB,
      refined: isRefineLeaf(spB),
    },
  ]
}

export type RefineTarget =
  | { kind: 'requirement'; requirement: Requirement }
  | { kind: 'task'; task: Task }

/** Pick the largest refinable requirement or task on a project. */
export function pickRefineTarget(project: Project): RefineTarget | null {
  const openRequirements = project.requirements
    .filter(canRefineRequirement)
    .sort((a, b) => b.storyPoints - a.storyPoints)
  if (openRequirements.length > 0) {
    return { kind: 'requirement', requirement: openRequirements[0] }
  }

  const refinableTasks = project.tasks
    .filter(canRefineTask)
    .sort((a, b) => b.storyPointsRequired - a.storyPointsRequired)
  if (refinableTasks.length > 0) {
    return { kind: 'task', task: refinableTasks[0] }
  }

  return null
}

export function projectHasRefineWork(project: Project): boolean {
  return pickRefineTarget(project) !== null
}

export function countActiveTasks(project: Project): number {
  return project.tasks.filter((t) => t.status !== 'merged').length
}

export function pickCodingTask(project: Project, agentId: string): Task | null {
  const own = project.tasks.find(
    (t) =>
      t.assignedAgentId === agentId &&
      (t.status === 'open' || t.status === 'in_progress'),
  )
  if (own) return own

  const available = project.tasks
    .filter(
      (t) =>
        (t.status === 'open' || t.status === 'in_progress') &&
        !t.assignedAgentId &&
        t.storyPointsEarned < t.storyPointsRequired,
    )
    .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)

  return available[0] ?? null
}

export function implementationTasks(project: Project): Task[] {
  return project.tasks.filter((t) => !t.isBugFix)
}

export function deliveredStoryPoints(project: Project): number {
  return implementationTasks(project)
    .filter((t) => t.status === 'merged')
    .reduce((sum, t) => sum + t.storyPointsRequired, 0)
}

export function allImplementationMerged(project: Project): boolean {
  const impl = implementationTasks(project)
  return impl.length > 0 && impl.every((t) => t.status === 'merged')
}

export function syncTestScope(project: Project): Project {
  if (!allImplementationMerged(project)) return project
  const required = deliveredStoryPoints(project)
  if (required <= 0) return project
  const completed = Math.min(project.testStoryPointsCompleted, required)
  const testPercent = required > 0 ? (completed / required) * 100 : 0
  return {
    ...project,
    testStoryPointsRequired: required,
    testStoryPointsCompleted: completed,
    testPercent,
  }
}

export function projectHasTestWork(project: Project): boolean {
  const synced = syncTestScope(project)
  return (
    allImplementationMerged(project) &&
    synced.testStoryPointsCompleted < synced.testStoryPointsRequired
  )
}

export function createBugFixTask(source: Task): Task {
  return {
    ...createTask(
      source.projectId,
      `Fix: ${source.title}`,
      source.storyPointsRequired,
      source.complexity,
      source.id,
    ),
    isBugFix: true,
    sourceTaskId: source.id,
    refined: true,
  }
}

export function hiddenBugsOnProject(project: Project): Task[] {
  return project.tasks.filter(
    (t) => t.status === 'merged' && t.hasUndiscoveredBug && !t.bugDiscovered,
  )
}
