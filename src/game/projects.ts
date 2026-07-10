import type { Agent, AgentJob, Lead, Project, Requirement, StaffJob, Task } from './types'
import { TUTORIAL_PAYMENT } from './constants'
import {
  agentIsBusy,
  FIBONACCI,
  fibIndex,
  pickLeadFibonacci,
  reviewCommentSpawnCount,
} from './mechanics'

const CLIENTS = [
  'Nexus Dynamics',
  'PivotPal',
  'StealthStartup.io',
  'MegaCorp Subsidiary',
  "Dave's Enterprise Solutions",
  'Blockchain For Dogs',
  'The Other Uber',
  'CloudSync (not that one)',
]

const BLURBS = [
  'Rebuild the dashboard but make it "pop".',
  'AI-powered spreadsheet. Yes, another one.',
  'Migrate our monolith to microservices by Friday.',
  "Add blockchain. We don't know why either.",
  "Fix the bug that only happens on the CEO's laptop.",
  'Implement Web3 login. Wallet optional, panic required.',
  'Refactor legacy PHP. The legacy is emotional.',
  'Make the app 10x faster without changing anything.',
]

export const REVIEW_COMMENT_TEXTS = [
  'We use 13-space indents here',
  "I don't like Times New Roman",
  'Please rename `data` to `theDataObjectFinal_v2`',
  'Could we use a different shade of beige?',
  'This function is 3 lines too long for my taste',
  'Add a comment explaining what this comment does',
  'Have you considered rewriting this in Rust?',
  'The variable name `user` feels too personal',
  'Needs more design patterns. Any will do.',
  'Can we make the logo bigger? In the backend?',
  "I don't think this aligns with my horoscope",
  'Please remove all vowels for performance',
  'This would read better in Comic Sans',
  'Where is the blockchain integration?',
  'LGTM but change everything',
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

const EMPTY_ROLE_COUNTS = {
  refine: 0,
  code: 0,
  review: 0,
  test: 0,
  conductor: 0,
}

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
    refined: true,
    status: 'open',
    assignedAgentId: null,
    completedByAgentId: null,
    parentTaskId,
    prQuality: null,
    prQualityStaging: 0,
    hasUndiscoveredBug: false,
    bugDiscovered: false,
    isBugFix: false,
    sourceTaskId: null,
    isReviewComment: false,
    reviewed: false,
    testStoryPointsEarned: 0,
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

function defaultProjectFields(projectId: string, sp: number) {
  return {
    deliveryQuality: 0,
    testPercent: 0,
    testStoryPointsRequired: 0,
    testStoryPointsCompleted: 0,
    totalStoryPoints: sp,
    status: 'active' as const,
    requirements: createRequirementsForProject(projectId, sp),
    tasks: [] as Task[],
    lateCount: 0,
    crewCap: 1,
    roleCounts: { ...EMPTY_ROLE_COUNTS, refine: 1 },
    useConductor: false,
  }
}

export function createTutorialProject(): Project {
  const projectId = uid('proj')
  const sp = 5

  return {
    id: projectId,
    clientName: 'Friendly Neighbor App',
    blurb: 'Tutorial gig. Assign a Refiner (+), turn the requirement into a task, then ship.',
    payment: TUTORIAL_PAYMENT,
    durationDays: 20,
    daysRemaining: 20,
    isTutorial: true,
    repPenaltyMultiplier: 1,
    ...defaultProjectFields(projectId, sp),
    requirements: [createRequirement(projectId, 'Users must be able to log in', sp)],
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
    storyPoints * (4 + reputation * 0.3) * (isUnreasonable ? 0.75 : 1),
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
    isTutorial: false,
    repPenaltyMultiplier: 1 + lead.durationDays / 40,
    ...defaultProjectFields(projectId, sp),
  }
}

export function canRefineRequirement(requirement: Requirement): boolean {
  return requirement.status === 'open'
}

export function requirementToTask(requirement: Requirement): Task {
  const sp = requirement.storyPoints
  return createTask(requirement.projectId, requirement.title, sp, fibIndex(sp))
}

/** Split one requirement into two equal-SP tasks (Prompt Engineering). */
export function splitRequirementToTasks(requirement: Requirement): Task[] {
  const half = requirement.storyPoints / 2
  return [
    createTask(requirement.projectId, `${requirement.title} (1)`, half, fibIndex(half)),
    createTask(requirement.projectId, `${requirement.title} (2)`, half, fibIndex(half)),
  ]
}

export function pickRefineTarget(
  project: Project,
  agents: Agent[],
  agentId: string,
): Requirement | null {
  const claimed = jobClaimedTaskIds(agents, project.id, 'refine', agentId)
  const self = agents.find((a) => a.id === agentId)

  if (self?.taskId) {
    const req = project.requirements.find((r) => r.id === self.taskId && canRefineRequirement(r))
    if (req) return req
  }

  const openRequirements = project.requirements
    .filter(canRefineRequirement)
    .filter((r) => !claimed.has(r.id))
    .sort((a, b) => b.storyPoints - a.storyPoints)

  return openRequirements[0] ?? null
}

export function projectHasRefineWork(project: Project): boolean {
  return project.requirements.some(canRefineRequirement)
}

export function jobClaimedTaskIds(
  agents: Agent[],
  projectId: string,
  job: AgentJob,
  exceptAgentId: string,
): Set<string> {
  const ids = new Set<string>()
  for (const agent of agents) {
    if (agent.id === exceptAgentId) continue
    if (agent.job !== job || agent.projectId !== projectId || !agent.taskId) continue
    if (!agentIsBusy(agent) && agent.status !== 'refining') continue
    ids.add(agent.taskId)
  }
  return ids
}

export function pickCodingTask(project: Project, agentId: string, agents: Agent[]): Task | null {
  const claimed = jobClaimedTaskIds(agents, project.id, 'code', agentId)

  const own = project.tasks.find(
    (t) =>
      t.assignedAgentId === agentId &&
      (t.status === 'open' || t.status === 'in_progress'),
  )
  if (own) return own

  const openComments = project.tasks
    .filter(
      (t) =>
        t.isReviewComment &&
        (t.status === 'open' || t.status === 'in_progress') &&
        !t.assignedAgentId &&
        !claimed.has(t.id) &&
        t.storyPointsEarned < t.storyPointsRequired,
    )
    .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)
  if (openComments.length > 0) return openComments[0]

  const available = project.tasks
    .filter(
      (t) =>
        !t.isReviewComment &&
        (t.status === 'open' || t.status === 'in_progress') &&
        !t.assignedAgentId &&
        !claimed.has(t.id) &&
        t.storyPointsEarned < t.storyPointsRequired,
    )
    .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)

  return available[0] ?? null
}

export function pickReviewTask(project: Project, agentId: string, agents: Agent[]): Task | null {
  const claimed = jobClaimedTaskIds(agents, project.id, 'review', agentId)
  const self = agents.find((a) => a.id === agentId)

  if (self?.taskId) {
    const current = project.tasks.find(
      (t) => t.id === self.taskId && t.status === 'pr_ready' && !t.reviewed,
    )
    if (current) return current
  }

  return (
    project.tasks.find(
      (t) => t.status === 'pr_ready' && !t.reviewed && !claimed.has(t.id),
    ) ?? null
  )
}

export function reviewCommentsOnTask(project: Project, parentTaskId: string): Task[] {
  return project.tasks.filter((t) => t.isReviewComment && t.parentTaskId === parentTaskId)
}

export function resolvedReviewComments(project: Project, parentTaskId: string): Task[] {
  return reviewCommentsOnTask(project, parentTaskId).filter(
    (t) => t.storyPointsEarned >= t.storyPointsRequired,
  )
}

export function allReviewCommentsAddressed(project: Project, parentTaskId: string): boolean {
  const comments = reviewCommentsOnTask(project, parentTaskId)
  return comments.every((c) => c.storyPointsEarned >= c.storyPointsRequired)
}

export function createReviewCommentTasks(parent: Task): Task[] {
  const count = reviewCommentSpawnCount(parent.storyPointsRequired)
  const pool = [...REVIEW_COMMENT_TEXTS]
  const comments: Task[] = []

  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    const text = pool.splice(idx, 1)[0] ?? REVIEW_COMMENT_TEXTS[0]
    comments.push({
      ...createTask(parent.projectId, text, 0.5, 0, parent.id),
      isReviewComment: true,
    })
  }

  return comments
}

export function projectRoleHasWork(
  project: Project,
  job: StaffJob,
  agentId: string,
  agents: Agent[],
): boolean {
  if (project.status !== 'active') return false
  switch (job) {
    case 'code':
      return pickCodingTask(project, agentId, agents) !== null
    case 'review':
      return (
        project.tasks.some((t) => t.status === 'pr_ready' && !t.reviewed) &&
        pickReviewTask(project, agentId, agents) !== null
      )
    case 'refine':
      return pickRefineTarget(project, agents, agentId) !== null
    case 'test':
      return projectHasTestWork(project) && pickTestTask(project, agentId, agents) !== null
  }
}

export function implementationTasks(project: Project): Task[] {
  return project.tasks.filter((t) => !t.isBugFix && !t.isReviewComment)
}

export function mergedImplementationTasks(project: Project): Task[] {
  return implementationTasks(project).filter((t) => t.status === 'merged')
}

export function mergedShippableTasks(project: Project): Task[] {
  return project.tasks.filter((t) => !t.isReviewComment && t.status === 'merged')
}

export function taskNeedsTesting(task: Task): boolean {
  return (
    task.status === 'merged' &&
    !task.isReviewComment &&
    task.testStoryPointsEarned < task.storyPointsRequired
  )
}

export function taskIsTested(task: Task): boolean {
  return (
    task.status === 'merged' &&
    !task.isReviewComment &&
    task.testStoryPointsEarned >= task.storyPointsRequired
  )
}

export function deliveredStoryPoints(project: Project): number {
  return mergedShippableTasks(project).reduce((sum, t) => sum + t.storyPointsRequired, 0)
}

export function completedTestStoryPoints(project: Project): number {
  return mergedShippableTasks(project).reduce(
    (sum, t) => sum + Math.min(t.testStoryPointsEarned, t.storyPointsRequired),
    0,
  )
}

export function untestedMergedTasks(project: Project): Task[] {
  return mergedShippableTasks(project).filter(taskNeedsTesting)
}

export function allImplementationMerged(project: Project): boolean {
  const impl = implementationTasks(project)
  return impl.length > 0 && impl.every((t) => t.status === 'merged')
}

export function syncTestScope(project: Project): Project {
  const required = deliveredStoryPoints(project)
  const completed = completedTestStoryPoints(project)
  return {
    ...project,
    testStoryPointsRequired: required,
    testStoryPointsCompleted: completed,
    testPercent: required > 0 ? (completed / required) * 100 : 0,
    deliveryQuality: averageMergedPrQuality(project),
  }
}

function averageMergedPrQuality(project: Project): number {
  const merged = mergedShippableTasks(project).filter((t) => t.prQuality !== null)
  if (merged.length === 0) return 0
  return merged.reduce((sum, t) => sum + (t.prQuality ?? 0), 0) / merged.length
}

export function projectHasTestWork(project: Project): boolean {
  return untestedMergedTasks(project).length > 0
}

export function pickTestTask(project: Project, agentId: string, agents: Agent[]): Task | null {
  const claimed = jobClaimedTaskIds(agents, project.id, 'test', agentId)
  const self = agents.find((a) => a.id === agentId)

  if (self?.taskId) {
    const current = project.tasks.find((t) => t.id === self.taskId && taskNeedsTesting(t))
    if (current) return current
  }

  const available = untestedMergedTasks(project)
    .filter((t) => !claimed.has(t.id))
    .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)

  return available[0] ?? null
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
  }
}

export const CONDUCTOR_ROLE_PRIORITY: StaffJob[] = ['refine', 'code', 'review', 'test']
