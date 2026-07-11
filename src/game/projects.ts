import type { Agent, AgentJob, Lead, Project, Requirement, StaffJob, Task } from './types'
import { TUTORIAL_PAYMENT } from './constants'
import { pickJokeClient } from './clients'
import {
  agentIsBusy,
  FIBONACCI,
  fibIndex,
  pickLeadFibonacci,
  reviewCommentSpawnCount,
} from './mechanics'
import { pickBugDescription, pickSubtaskTitles } from './refinementContent'

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
  'Can we alphabetize these imports by emotional weight?',
  'This null check is too confident',
  'Please add a TODO to remove this TODO',
  'I feel like this code is judging me',
  'Have we considered making the database optional?',
  'The error message is too helpful',
  'Can we use more emojis in the commit message body?',
  'This looks like it might work on my machine',
  'Please wrap every line at 37 characters',
  'I would prefer if the API responded in haiku',
  'This variable name is too descriptive',
  'Can we add blockchain to the linter config?',
  'The tests pass and that concerns me',
  'Please invert all the booleans for consistency',
  'This PR needs more tabs. And fewer tabs.',
  'Can we rename `id` to `thePrimaryIdentifierOfRecord`?',
  'I think this function should be async for vibes',
  'Please add a disclaimer that this code is AI-generated (it is not)',
  'The spacing here feels emotionally distant',
  'Can we use a darker dark mode?',
  'This regex is too readable',
  'Please add a feature flag for the feature flag',
  'I do not trust this semicolon',
  'Can we make the build slower for security?',
  'This code comment is not passive-aggressive enough',
  'Please replace all `for` loops with interpretive dance',
  'The logo in the README is not centered on the moon',
  'Can we use XML instead? I miss 2004',
  'This function has too few side effects',
  'Please add Kubernetes for this static HTML page',
  'I would merge this if it were written in COBOL',
  'Can we add more layers of abstraction? I can still see the problem',
  'The variable `temp` should be renamed to `permanent`',
  'Please remove the bug. Keep the feature that causes it.',
  'This code does not spark joy',
  'Can we add a webhook that fires when someone thinks about webhooks?',
  'I need this refactored into a microservice per line',
  'Please add more singletons. The app feels too humble.',
  'The catch block is too honest about failures',
  'Can we use a font that conveys enterprise synergy?',
  'This PR is 400 lines. My attention span is 12.',
  'Please add a `// FIXME` on line 1 of the repo',
  'I do not like that this works',
  'Can we make the database schema more opinionated about my life choices?',
  'This constant should be configurable, hardcoded, and secret',
  'Please add AI to the AI feature',
  'The indentation suggests anarchism',
  'Can we use GraphQL for this `hello world`?',
  'This code review is taking longer than the code',
  'Please add a migration to migrate the migrations',
  'I think the button should be more button-shaped',
  'Can we cache this at every layer including the cache?',
  'This error handling is too graceful',
  'Please add a README explaining why we have no README',
  'The function name `doThing` is too specific',
  'Can we add observability to the observability dashboard?',
  'I would approve this if it were written yesterday',
  'Please use more ternary operators. Nesting encouraged.',
  'This code smells like competence',
  'Can we add a staging environment for staging environments?',
  'The API response is too JSON-shaped',
  'Please add a linter rule banning linter rules',
  'I do not understand this and therefore it is wrong',
  'Can we make the deploy rollback forward-only?',
  'This variable is declared too close to where it is used',
  'Please add a meeting to discuss this comment',
  'The unit tests test units. Suspicious.',
  'Can we use a different cloud? This one has clouds.',
  'This PR needs more buzzwords in the description',
  'Please add a `sleep(1000)` for realism',
  'I think the database query is too SQL',
  'Can we add NFTs to the login flow?',
  'This code is not over-engineered enough',
  'Please rename `utils.ts` to `miscellaneousChaos.ts`',
  'The happy path is too happy',
  'Can we add a cron job that runs every second?',
  'I would like this rewritten using only global variables',
  'Please add more environment variables. I enjoy `.env` archaeology.',
  'This function returns a value. Unexpected.',
  'Can we use machine learning to predict these review comments?',
  'The code coverage is too honest about what we test',
  'Please add a dependency on a package with 3 weekly downloads',
  'I do not like the color of the syntax highlighting in my head',
  'Can we make the mobile app desktop-only?',
  'This PR fixes the bug but introduces vibes I disagree with',
  'Please add a `// TODO: delete everything` for roadmap clarity',
  'The variable `i` should be renamed to `iteratorOfDestiny`',
  'Can we add a second database for the first database?',
  'This code is too DRY. I prefer a light drizzle.',
  'Please add a feature that emails me when someone emails me',
  'I think we need more indirection between the indirection',
  'Can we use a custom date format? YYYY-MM-DD is too ISO',
  'This merge conflict resolution feels too resolved',
  'Please add a health check that checks if health checks are healthy',
  'The log message is too informative for production',
  'Can we add WebAssembly for this CSS file?',
  'I would merge this if the author were different',
  'Please replace `if` statements with `while(false)` blocks',
  'This API endpoint has too few endpoints inside it',
  'Can we add a monorepo inside the monorepo?',
  'The code style is consistent and I find that threatening',
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
  'Export to PDF, CSV, and interpretive dance',
  'Search bar that finds things on purpose',
  'Onboarding flow shorter than a Netflix intro',
  'Password reset that does not require a séance',
  'Notifications users asked for, not haunted',
  'Billing page that explains the charge',
  'Settings screen with fewer than 900 toggles',
  'Profile photo upload without sacrificing a goat',
  'Two-factor auth that works on the first try',
  'Audit log for when Steve deletes production',
  'Role-based access based on actual roles',
  'Email templates that do not look like scams',
  'Calendar sync that syncs both ways',
  'File upload limit higher than one emoji',
  'Pagination that paginates',
  'Infinite scroll with a finite conscience',
  'Keyboard shortcuts for power users only',
  'Accessibility pass that includes humans',
  'i18n support for at least two languages',
  'Timezone handling for people who travel',
  'Soft delete so regrets are reversible',
  'Bulk actions that work in bulk',
  'CSV import that accepts real CSVs',
  'Reporting dashboard the CEO will not misread',
  'API versioning before v1 becomes folklore',
  'Webhook retries that retry',
  'SLA page we can almost defend',
  'Status page greener than our staging env',
  'Incident postmortem template included',
  'Feature flags that can be turned off',
  'A/B test framework with a B that works',
  'Analytics that respect do-not-track',
  'Cookie banner shorter than the codebase',
  'GDPR export in less than a geological era',
  'SSO login for clients who forgot passwords',
  'OAuth flow without the OAuth trauma',
  'Magic link emails that arrive this decade',
  'Invite system that invites people',
  'Team management without HR involvement',
  'Comments thread that does not become Slack',
  'Real-time updates that are actually real-time',
  'Offline mode for the Wi-Fi outage demo',
  'PWA install prompt that is not annoying',
  'Push notifications with an off switch',
  'In-app chat that someone will monitor',
  'Help center search that finds help',
  'Changelog users might read',
  'Release notes auto-generated but legible',
  'Version number that means something',
  'Deprecation warnings before deprecation',
  'Migration script that migrates',
  'Seed data that is not embarrassing',
  'Staging environment that resembles reality',
  'CI pipeline that finishes before retirement',
  'Preview deploys for every PR',
  'Rollback button prominently labeled',
  'Database backups tested occasionally',
  'Secrets not committed this time',
  'Environment variables documented somewhere',
  'Docker compose that composes',
  'Kubernetes manifests optional and ignored',
  'Load test results that inspire confidence',
  'Performance budget under one elephant',
  'Image optimization because photos exist',
  'CDN configured for more than localhost',
  'SSL certificate that renews itself',
  'Custom domain without DNS yoga',
  'SEO metadata that is not lorem ipsum',
  'Open Graph tags for LinkedIn lurkers',
  'Sitemap generated automatically',
  'Robots.txt that robots understand',
  '404 page with personality, not despair',
  '500 page that does not blame the user',
  'Maintenance mode message written in advance',
  'Health check endpoint for the health check',
  'Metrics exported to something with graphs',
  'Logging structured enough to grep',
  'Tracing across microservices we regret',
  'Error tracking that tracks errors',
  'Uptime monitor that monitors uptime',
  'Alerting that alerts the right people',
  'On-call runbook longer than one line',
  'Documentation that matches the product',
  'README install steps that work',
  'Architecture diagram from this century',
  'API docs generated and accurate',
  'Postman collection included',
  'SDK for the one client who asked',
  'Rate limits documented before users hit them',
  'Idempotency keys for the anxious',
  'Pagination cursors that cursor',
  'Filtering that filters',
  'Sorting that sorts predictably',
  'Full-text search without sacrificing a RAM stick',
  'Autocomplete faster than user regret',
  'Form validation on blur and on submit',
  'Autosave so refresh is not a tragedy',
  'Undo for destructive actions',
  'Confirmation modal for the delete button',
  'Drag and drop that drops in the right place',
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
  requirementId: string | null = null,
): Task {
  return {
    id: uid('task'),
    projectId,
    requirementId,
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
  const sp = 4

  return {
    id: projectId,
    clientName: 'Friendly Neighbor App',
    clientTagline: 'Hyperlocal. Hypothetical.',
    blurb: 'Tutorial gig. Refine each requirement into a task, then ship.',
    payment: TUTORIAL_PAYMENT,
    durationDays: 20,
    daysRemaining: 20,
    isTutorial: true,
    repPenaltyMultiplier: 1,
    ...defaultProjectFields(projectId, sp),
    requirements: [
      createRequirement(projectId, 'Users must be able to log in', 2),
      createRequirement(projectId, 'Dashboard needs to not look like 2009', 1),
      createRequirement(projectId, 'API must return JSON sometimes', 1),
    ],
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

  const client = pickJokeClient()

  return {
    id: uid('lead'),
    clientName: client.name,
    clientTagline: client.tagline,
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
    clientTagline: lead.clientTagline,
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
  const [task] = refineRequirementToTasks(requirement, { preferSplit: false, forceSingle: true })
  return task
}

/** Split one requirement into two equal-SP tasks (legacy Prompt Engineering path). */
export function splitRequirementToTasks(requirement: Requirement): Task[] {
  return refineRequirementToTasks(requirement, { preferSplit: true, forceSplit: true })
}

function splitStoryPoints(total: number): [number, number] | null {
  const idx = fibIndex(total)
  if (idx < 2 || total < 2) return null
  const spA = FIBONACCI[idx - 1]
  const spB = total - spA
  if (spB <= 0 || !FIBONACCI.includes(spB as (typeof FIBONACCI)[number])) return null
  return [spA, spB]
}

export function refineRequirementToTasks(
  requirement: Requirement,
  options: { preferSplit?: boolean; forceSplit?: boolean; forceSingle?: boolean } = {},
): Task[] {
  const { preferSplit = false, forceSplit = false, forceSingle = false } = options
  const sp = requirement.storyPoints

  let shouldSplit = false
  if (!forceSingle && sp >= 2) {
    if (forceSplit) {
      shouldSplit = splitStoryPoints(sp) !== null
    } else {
      const splitChance = preferSplit ? 0.85 : 0.4
      shouldSplit = Math.random() < splitChance && splitStoryPoints(sp) !== null
    }
  }

  if (shouldSplit) {
    const parts = splitStoryPoints(sp)!
    const titles = pickSubtaskTitles(requirement.title, 2)
    return [
      createTask(requirement.projectId, titles[0], parts[0], fibIndex(parts[0]), null, requirement.id),
      createTask(requirement.projectId, titles[1], parts[1], fibIndex(parts[1]), null, requirement.id),
    ]
  }

  const [title] = pickSubtaskTitles(requirement.title, 1)
  return [createTask(requirement.projectId, title, sp, fibIndex(sp), null, requirement.id)]
}

export function tasksForRequirement(project: Project, requirementId: string): Task[] {
  return project.tasks.filter((t) => t.requirementId === requirementId && !t.isReviewComment)
}

export function taskIsFullyComplete(task: Task): boolean {
  return task.status === 'merged' && taskIsTested(task)
}

export function requirementHasOpenBugFix(project: Project, requirementId: string): boolean {
  return tasksForRequirement(project, requirementId).some(
    (t) => t.isBugFix && !taskIsFullyComplete(t),
  )
}

export function requirementIsFullyComplete(project: Project, requirement: Requirement): boolean {
  if (requirement.status === 'open') return false
  const tasks = tasksForRequirement(project, requirement.id)
  if (tasks.length === 0) return false
  if (requirementHasOpenBugFix(project, requirement.id)) return false
  return tasks.every(taskIsFullyComplete)
}

export function visibleRequirements(project: Project): Requirement[] {
  return project.requirements.filter((r) => !requirementIsFullyComplete(project, r))
}

export function requirementTestPercent(project: Project, requirementId: string): number {
  const merged = tasksForRequirement(project, requirementId).filter((t) => t.status === 'merged')
  if (merged.length === 0) return 0
  const required = merged.reduce((sum, t) => sum + t.storyPointsRequired, 0)
  const completed = merged.reduce(
    (sum, t) => sum + Math.min(t.testStoryPointsEarned, t.storyPointsRequired),
    0,
  )
  return required > 0 ? (completed / required) * 100 : 0
}

export function requirementRefineProgressPct(
  project: Project,
  requirement: Requirement,
  agents: Agent[],
): number | null {
  if (requirement.status !== 'open') return null
  const refiner = agents.find(
    (a) =>
      a.job === 'refine' &&
      a.projectId === project.id &&
      a.taskId === requirement.id &&
      a.jobDuration > 0,
  )
  if (!refiner) return null
  return Math.min(100, (refiner.jobProgress / refiner.jobDuration) * 100)
}

export function taskLifecycleProgressPct(
  task: Task,
  project: Project,
  agents: Agent[],
): number {
  if (task.isReviewComment) {
    return Math.min(100, (task.storyPointsEarned / task.storyPointsRequired) * 100)
  }

  if (task.status === 'open' || task.status === 'in_progress') {
    return Math.min(100, (task.storyPointsEarned / task.storyPointsRequired) * 100)
  }

  if (task.status === 'pr_ready') {
    const reviewer = agents.find((a) => a.job === 'review' && a.taskId === task.id)
    if (reviewer && reviewer.jobDuration > 0 && !task.reviewed) {
      return Math.min(100, (reviewer.jobProgress / reviewer.jobDuration) * 100)
    }
    const comments = reviewCommentsOnTask(project, task.id)
    if (comments.length > 0) {
      const resolved = resolvedReviewComments(project, task.id).length
      return Math.min(100, (resolved / comments.length) * 100)
    }
    return task.reviewed ? 100 : 0
  }

  if (task.status === 'merged') {
    return Math.min(100, (task.testStoryPointsEarned / task.storyPointsRequired) * 100)
  }

  return 0
}

export function taskLifecycleLabel(task: Task, project: Project): string {
  if (task.status === 'open' || task.status === 'in_progress') return 'coding'
  if (task.status === 'pr_ready') {
    const comments = reviewCommentsOnTask(project, task.id)
    if (comments.length > 0 && !comments.every((c) => c.storyPointsEarned >= c.storyPointsRequired)) {
      return 'addressing review'
    }
    return 'review'
  }
  if (task.status === 'merged' && taskNeedsTesting(task)) return 'testing'
  return task.status.replace('_', ' ')
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
      pickBugDescription(),
      source.storyPointsRequired,
      source.complexity,
      source.id,
      source.requirementId,
    ),
    isBugFix: true,
    sourceTaskId: source.id,
  }
}

export const CONDUCTOR_ROLE_PRIORITY: StaffJob[] = ['refine', 'code', 'review', 'test']
