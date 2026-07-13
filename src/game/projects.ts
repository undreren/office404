import type { Agent, AgentJob, GameState, Lead, LeadSource, Project, ProjectKind, Requirement, StaffJob, Task } from './types'
import { MIN_PROJECT_DAYS, TUTORIAL_PAYMENT, MAX_CLIENT_TASK_SP } from './constants'
import { pickJokeClient } from './clients'
import {
  FIBONACCI,
  fibIndex,
  isFibonacci,
  maxRequirementSpForReputation,
  pickLeadTotalStoryPoints,
  clientPaymentForTotalSp,
  repZeroPaymentMultiplier,
  reviewCommentSpawnCount,
} from './mechanics'
import { pickBugDescription, pickSubtaskTitles } from './refinementContent'
import { type SimCtx, ctxFrom, uid } from './simulation/simCtx'

export type { SimCtx } from './simulation/simCtx'

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
  'Users must be able to log in without a séance',
  'Dashboard needs to not look like it misses 2009',
  'API must return JSON sometimes, never XML emotionally',
  'Mobile layout cannot be a war crime under Geneva',
  'Admin panel with god-mode toggles and accountability off',
  'Webhooks that fire when something actually happens',
  'Rate limiting for the one user who types in ALL CAPS',
  'Dark mode (legally mandated by the vibes council)',
  'Error messages parseable without a law degree',
  'Caching layer because the database started crying',
  'Export to PDF, CSV, and interpretive dance',
  'Search bar that finds things on purpose',
  'Onboarding flow shorter than a Netflix intro',
  'Password reset that does not require a medium',
  'Notifications users asked for, not haunted',
  'Billing page that explains the charge in English',
  'Settings screen with fewer than 900 toggles',
  'Profile photo upload without sacrificing a goat',
  'Two-factor auth that works on the first try (wild)',
  'Audit log for when Steve deletes production again',
  'Role-based access based on actual roles, not vibes',
  'Email templates that do not look like scams',
  'Calendar sync that syncs both ways, not one-way gaslighting',
  'File upload limit higher than one emoji',
  'Pagination that paginates instead of gaslights',
  'Infinite scroll with a finite conscience',
  'Keyboard shortcuts for power users only (normies may observe)',
  'Accessibility pass that includes humans, not just audit bots',
  'i18n support for at least two languages and zero typos',
  'Timezone handling for people who travel and lie about it',
  'Soft delete so regrets are reversible, unlike tweets',
  'Bulk actions that work in bulk, not one random row',
  'CSV import that accepts real CSVs, not vibes spreadsheets',
  'Reporting dashboard the CEO will misread anyway',
  'API versioning before v1 becomes company folklore',
  'Webhook retries that retry the right webhook',
  'SLA page we can almost defend in court',
  'Status page greener than our staging env on fire',
  'Incident postmortem template pre-filled with "human error"',
  'Feature flags that can be turned off when things get weird',
  'A/B test framework with a B that actually works',
  'Analytics that respect do-not-track and your dignity',
  'Cookie banner shorter than the codebase',
  'GDPR export in less than a geological era',
  'SSO login for clients who forgot passwords and dignity',
  'OAuth flow without the OAuth trauma flashbacks',
  'Magic link emails that arrive this decade, not the next',
  'Invite system that invites people, not spam folders',
  'Team management without HR getting involved (yet)',
  'Comments thread that does not become Slack',
  'Real-time updates that are actually real-time-ish',
  'Offline mode for the Wi-Fi outage demo that always happens live',
  'PWA install prompt that is not aggressively annoying',
  'Push notifications with an off switch users can find',
  'In-app chat that someone will monitor (eventually)',
  'Help center search that finds help, not despair',
  'Changelog users might read before ignoring',
  'Release notes auto-generated but still legible',
  'Version number that means something other than "latest"',
  'Deprecation warnings before deprecation, not after',
  'Migration script that migrates data, not hopes',
  'Seed data that is not embarrassing on demo day',
  'Staging environment that resembles reality, not localhost',
  'CI pipeline that finishes before retirement',
  'Preview deploys for every PR, including the bad ones',
  'Rollback button prominently labeled and not booby-trapped',
  'Database backups tested occasionally, not just assumed',
  'Secrets not committed this time (we learned)',
  'Environment variables documented somewhere findable',
  'Docker compose that composes instead of improvises jazz',
  'Kubernetes manifests optional, ignored, and spiritually present',
  'Load test results that inspire confidence, not prayer',
  'Performance budget under one elephant (metric unclear)',
  'Image optimization because photos exist and weigh megabytes',
  'CDN configured for more than localhost and hope',
  'SSL certificate that renews itself before the panic',
  'Custom domain without DNS yoga or sacrifice',
  'SEO metadata that is not lorem ipsum in disguise',
  'Open Graph tags for LinkedIn lurkers and humblebraggers',
  'Sitemap generated automatically, not by intern at 3am',
  'Robots.txt that robots understand and Bing respects',
  '404 page with personality, not existential despair',
  '500 page that does not blame the user (much)',
  'Maintenance mode message written before the outage',
  'Health check endpoint for the health check\'s health',
  'Metrics exported to something with actual graphs',
  'Logging structured enough to grep without crying',
  'Tracing across microservices we already regret',
  'Error tracking that tracks errors into something visible',
  'Uptime monitor that monitors uptime, not vibes',
  'Alerting that alerts the right people, not everyone',
  'On-call runbook longer than "good luck"',
  'Documentation that matches the product we imagined',
  'README install steps that work on a machine from 2019',
  'Architecture diagram from this century, not a single box labeled "magic"',
  'API docs generated and allegedly accurate',
  'Postman collection included, working responses sold separately',
  'SDK for the one client who asked and three who didn\'t',
  'Rate limits documented before users hit them angrily',
  'Idempotency keys for the anxious double-clickers',
  'Pagination cursors that cursor instead of wander',
  'Filtering that filters, not philosophically debates',
  'Sorting that sorts predictably, not by vibe',
  'Full-text search without sacrificing a RAM stick',
  'Autocomplete faster than user regret',
  'Form validation on blur, on submit, and on bad life choices',
  'Autosave so refresh is not a personal tragedy',
  'Undo for destructive actions and destructive meetings',
  'Confirmation modal for the delete button (and the nuclear option)',
  'Drag and drop that drops in the right place, not /dev/null',
]

const EMPTY_ROLE_COUNTS = {
  refine: 0,
  code: 0,
  review: 0,
  test: 0,
  conductor: 0,
}

export function createRequirement(
  ctx: SimCtx,
  projectId: string,
  title: string,
  storyPoints: number,
): Requirement {
  return {
    id: uid(ctx, 'req'),
    projectId,
    title,
    storyPoints,
    status: 'open',
    refinePassesUsed: 0,
  }
}

export function createTask(
  ctx: SimCtx,
  projectId: string,
  title: string,
  storyPoints: number,
  complexity: number,
  parentTaskId: string | null = null,
  requirementId: string | null = null,
): Task {
  return {
    id: uid(ctx, 'task'),
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
    refinePassesRemaining: 0,
  }
}

/** Split total SP into requirement chunks (each ≤ maxChunkSp). */
export function decomposeTotalSp(totalSp: number, maxChunkSp = MAX_CLIENT_TASK_SP): number[] {
  const parts: number[] = []
  let left = totalSp
  const cap = Math.max(1, maxChunkSp)
  while (left > 0) {
    const chunkCap = Math.min(left, cap)
    let best = chunkCap
    for (const f of FIBONACCI) {
      if (f <= chunkCap) best = f
      else break
    }
    const chunk = left <= best ? left : best
    parts.push(chunk)
    left -= chunk
  }
  return parts
}

export function createRequirementsForProject(
  ctx: SimCtx,
  projectId: string,
  totalSp: number,
  maxChunkSp = MAX_CLIENT_TASK_SP,
): Requirement[] {
  const chunks = decomposeTotalSp(totalSp, maxChunkSp)
  const titles = [...REQUIREMENT_TITLES]
  return chunks.map((sp) => {
    const title = ctx.rng.pick(titles)
    return createRequirement(ctx, projectId, title, sp)
  })
}

export function defaultProjectFields(
  ctx: SimCtx,
  projectId: string,
  sp: number,
  kind: ProjectKind = 'client',
  maxChunkSp = MAX_CLIENT_TASK_SP,
) {
  return {
    deliveryQuality: 0,
    testPercent: 0,
    testStoryPointsRequired: 0,
    testStoryPointsCompleted: 0,
    totalStoryPoints: sp,
    status: 'active' as const,
    kind,
    requirements: createRequirementsForProject(ctx, projectId, sp, maxChunkSp),
    tasks: [] as Task[],
    lateCount: 0,
    roleCounts: { ...EMPTY_ROLE_COUNTS },
    useConductor: false,
    duplicateProjectId: null,
    mrrContribution: 0,
  }
}

export function createTutorialProject(ctx: SimCtx): Project {
  const projectId = uid(ctx, 'proj')
  const sp = 4

  return {
    id: projectId,
    clientName: "Your Uncle's Totally Legal Web Shop",
    clientTagline: 'Imports "vitamins." Exports vibes.',
    blurb: 'He paid you in exposure and a firm handshake. Build the shop. Do not ask what he sells.',
    payment: TUTORIAL_PAYMENT,
    durationDays: 20,
    daysRemaining: 20,
    isTutorial: true,
    repPenaltyMultiplier: 1,
    ...defaultProjectFields(ctx, projectId, sp, 'client'),
    requirements: [
      createRequirement(ctx, projectId, 'Customers need a login. Uncle needs plausible deniability.', 2),
      createRequirement(ctx, projectId, "The homepage can't look like a 2009 phishing site. Uncle insists it already doesn't.", 1),
      createRequirement(ctx, projectId, 'Checkout must work. Crypto preferred. Questions discouraged.', 1),
    ],
  }
}

export function generateLead(
  ctx: SimCtx,
  reputation: number,
  gameDay: number,
  source: LeadSource = 'real',
  syntheticPayMult = 1,
): Lead {
  const repFactor = Math.max(1, Math.max(0, reputation) / 10)
  const dayFactor = 1 + Math.pow(gameDay / 100, 1.2) * 0.5
  const isUnreasonable = reputation > 25

  const storyPoints = pickLeadTotalStoryPoints(ctx.rng, reputation)
  const durationDays = Math.max(
    MIN_PROJECT_DAYS,
    Math.round(
      (isUnreasonable ? ctx.rng.int(10, 18) : ctx.rng.int(15, 35)) / (repFactor * dayFactor),
    ),
  )
  const payment = Math.round(
    clientPaymentForTotalSp(storyPoints, reputation, isUnreasonable) *
      repZeroPaymentMultiplier(reputation) *
      (source === 'synthetic' ? syntheticPayMult : 1),
  )

  const client = pickJokeClient(ctx.rng)

  return {
    id: uid(ctx, 'lead'),
    clientName: client.name,
    clientTagline: client.tagline,
    blurb: ctx.rng.pick(BLURBS),
    payment,
    durationDays,
    totalStoryPoints: storyPoints,
    spawnedGameDay: gameDay,
    status: 'available',
    repRequired: source === 'synthetic' ? 0 : Math.max(0, ctx.rng.int(0, Math.floor(Math.max(0, reputation) * 0.6))),
    source,
    estimatedDollarsPerSp: payment / Math.max(1, storyPoints),
    ghostRisk: source === 'synthetic' ? 0.1 : 0,
  }
}

/** Days waited on a lead before accepting — each day shaves one day off the project deadline. */
export function leadDaysWaited(lead: Lead, acceptGameDay: number): number {
  const spawned = lead.spawnedGameDay ?? acceptGameDay
  return Math.max(0, Math.floor(acceptGameDay - spawned))
}

export function effectiveLeadDuration(lead: Lead, acceptGameDay: number): number {
  return Math.max(MIN_PROJECT_DAYS, lead.durationDays - leadDaysWaited(lead, acceptGameDay))
}

export function createProjectFromLead(
  ctx: SimCtx,
  lead: Lead,
  acceptGameDay: number,
  reputation: number,
  refineHallucinationLevel = 0,
): Project {
  const projectId = uid(ctx, 'proj')
  const sp = lead.totalStoryPoints
  const effectiveDuration = effectiveLeadDuration(lead, acceptGameDay)
  const maxChunkSp = maxRequirementSpForReputation(reputation, refineHallucinationLevel)

  return {
    id: projectId,
    clientName: lead.clientName,
    clientTagline: lead.clientTagline,
    blurb: lead.blurb,
    payment: lead.payment,
    durationDays: effectiveDuration,
    daysRemaining: effectiveDuration,
    isTutorial: false,
    isSynthetic: lead.source === 'synthetic',
    repPenaltyMultiplier: 1 + effectiveDuration / 40,
    ...defaultProjectFields(ctx, projectId, sp, 'client', maxChunkSp),
  }
}

export function canRefineRequirement(requirement: Requirement): boolean {
  return requirement.status === 'open'
}

export function requirementToTask(ctx: SimCtx, requirement: Requirement): Task {
  const [task] = refineRequirementToTasks(ctx, requirement, { preferSplit: false, forceSingle: true })
  return task
}

/** Split one requirement into two equal-SP tasks (legacy Prompt Engineering path). */
export function splitRequirementToTasks(ctx: SimCtx, requirement: Requirement): Task[] {
  return refineRequirementToTasks(ctx, requirement, { preferSplit: true, forceSplit: true })
}

function splitStoryPoints(total: number): [number, number] | null {
  if (!isFibonacci(total) || total < 2) return null
  const idx = FIBONACCI.indexOf(total as (typeof FIBONACCI)[number])
  const spA = FIBONACCI[idx - 1]!
  const spB = total - spA
  if (spB <= 0 || !isFibonacci(spB)) return null
  return [spA, spB]
}

function passesAfterRefine(task: Task): number {
  return Math.max(0, (task.refinePassesRemaining ?? 1) - 1)
}

function splitOptionsForTier(refinementTier: number): { preferSplit: boolean; forceSplit: boolean } {
  return {
    preferSplit: refinementTier > 0,
    forceSplit: refinementTier >= 2,
  }
}

function shouldSplitStoryPoints(
  ctx: SimCtx,
  sp: number,
  options: { preferSplit?: boolean; forceSplit?: boolean; forceSingle?: boolean },
): boolean {
  const { preferSplit = false, forceSplit = false, forceSingle = false } = options
  if (forceSingle || sp < 2 || splitStoryPoints(sp) === null) return false
  if (forceSplit) return true
  const splitChance = preferSplit ? 0.85 : 0.4
  return ctx.rng.chance(splitChance)
}

function tasksFromSplit(
  ctx: SimCtx,
  projectId: string,
  sourceTitle: string,
  sp: number,
  requirementId: string | null,
  parentTaskId: string | null,
  refinePassesRemaining: number,
): Task[] {
  if (splitStoryPoints(sp) !== null) {
    const parts = splitStoryPoints(sp)!
    const titles = pickSubtaskTitles(ctx.rng, sourceTitle, 2)
    return [
      {
        ...createTask(ctx, projectId, titles[0], parts[0], fibIndex(parts[0]), parentTaskId, requirementId),
        refinePassesRemaining,
      },
      {
        ...createTask(ctx, projectId, titles[1], parts[1], fibIndex(parts[1]), parentTaskId, requirementId),
        refinePassesRemaining,
      },
    ]
  }

  const [title] = pickSubtaskTitles(ctx.rng, sourceTitle, 1)
  return [
    {
      ...createTask(ctx, projectId, title, sp, fibIndex(sp), parentTaskId, requirementId),
      refinePassesRemaining,
    },
  ]
}

export function refineRequirementToTasks(
  ctx: SimCtx,
  requirement: Requirement,
  options: { preferSplit?: boolean; forceSplit?: boolean; forceSingle?: boolean; refinementTier?: number } = {},
): Task[] {
  const { refinementTier = 0, forceSingle = false } = options
  const tierSplit = splitOptionsForTier(refinementTier)
  const sp = requirement.storyPoints
  const refinePassesRemaining = refinementTier
  const shouldSplit = shouldSplitStoryPoints(ctx, sp, {
    preferSplit: options.preferSplit ?? tierSplit.preferSplit,
    forceSplit: options.forceSplit ?? tierSplit.forceSplit,
    forceSingle,
  })

  if (shouldSplit) {
    return tasksFromSplit(ctx, requirement.projectId, requirement.title, sp, requirement.id, null, refinePassesRemaining)
  }

  const [title] = pickSubtaskTitles(ctx.rng, requirement.title, 1)
  return [
    {
      ...createTask(ctx, requirement.projectId, title, sp, fibIndex(sp), null, requirement.id),
      refinePassesRemaining,
    },
  ]
}

export function taskNeedsRefinement(task: Task): boolean {
  return (
    (task.refinePassesRemaining ?? 0) > 0 &&
    !task.isBugFix &&
    !task.isReviewComment &&
    (task.status === 'open' || task.status === 'in_progress') &&
    task.storyPointsEarned === 0
  )
}

export function canRefineTask(task: Task): boolean {
  return (
    taskNeedsRefinement(task) &&
    task.storyPointsRequired >= 2 &&
    splitStoryPoints(task.storyPointsRequired) !== null
  )
}

export function taskRefineProgressPct(
  task: Task,
  project: Project,
  agents: Agent[],
): number | null {
  if (!taskNeedsRefinement(task)) return null
  const refiner = agents.find(
    (a) =>
      a.job === 'refine' &&
      a.projectId === project.id &&
      a.taskId === task.id &&
      a.jobDuration > 0,
  )
  if (refiner) {
    return Math.min(100, (refiner.jobProgress / refiner.jobDuration) * 100)
  }
  if (task.refineJobDuration && task.refineJobDuration > 0) {
    return Math.min(100, ((task.refineJobProgress ?? 0) / task.refineJobDuration) * 100)
  }
  return 0
}

export function refineTaskToTasks(ctx: SimCtx, task: Task): Task[] {
  const passesAfter = passesAfterRefine(task)
  return tasksFromSplit(
    ctx,
    task.projectId,
    task.title,
    task.storyPointsRequired,
    task.requirementId,
    task.parentTaskId ?? task.id,
    passesAfter,
  )
}

export type RefineTarget =
  | { kind: 'requirement'; requirement: Requirement }
  | { kind: 'task'; task: Task }

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
  if (refiner) {
    return Math.min(100, (refiner.jobProgress / refiner.jobDuration) * 100)
  }
  if (requirement.refineJobDuration && requirement.refineJobDuration > 0) {
    return Math.min(
      100,
      ((requirement.refineJobProgress ?? 0) / requirement.refineJobDuration) * 100,
    )
  }
  return null
}

export function taskLifecycleProgressPct(
  task: Task,
  project: Project,
  agents: Agent[],
): number {
  if (task.isReviewComment) {
    return Math.min(100, (task.storyPointsEarned / task.storyPointsRequired) * 100)
  }

  if (canRefineTask(task)) {
    return taskRefineProgressPct(task, project, agents) ?? 0
  }

  if (task.status === 'open' || task.status === 'in_progress') {
    return Math.min(100, (task.storyPointsEarned / task.storyPointsRequired) * 100)
  }

  if (task.status === 'pr_ready') {
    const reviewer = agents.find((a) => a.job === 'review' && a.taskId === task.id)
    if (reviewer && reviewer.jobDuration > 0 && !task.reviewed) {
      return Math.min(100, (reviewer.jobProgress / reviewer.jobDuration) * 100)
    }
    if (task.reviewJobDuration && task.reviewJobDuration > 0 && !task.reviewed) {
      return Math.min(100, ((task.reviewJobProgress ?? 0) / task.reviewJobDuration) * 100)
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
  if (canRefineTask(task)) return 'refining'
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

type RefineQueueItem =
  | ({ kind: 'requirement'; requirement: Requirement } & { id: string })
  | ({ kind: 'task'; task: Task } & { id: string })

/** Agents on a project role who can contribute output this tick (global roster order). */
export function dispatchableAgents(agents: Agent[], projectId: string, job: AgentJob): Agent[] {
  const rosterOrder = new Map(agents.map((a, i) => [a.id, i]))
  return agents
    .filter(
      (a) =>
        a.job === job &&
        a.projectId === projectId &&
        a.status !== 'compacting' &&
        a.status !== 'compacted' &&
        a.status !== 'crashed',
    )
    .sort((a, b) => (rosterOrder.get(a.id) ?? 0) - (rosterOrder.get(b.id) ?? 0))
}

function dispatchFillFirst<T extends { id: string }>(
  project: Project,
  agentId: string,
  agents: Agent[],
  job: AgentJob,
  queue: T[],
  maxPerTask: number,
  slotsThisTick: Map<string, number>,
): T | null {
  const workers = dispatchableAgents(agents, project.id, job)
  if (!workers.some((a) => a.id === agentId)) return null

  for (const item of queue) {
    const used = slotsThisTick.get(item.id) ?? 0
    if (used < maxPerTask) {
      slotsThisTick.set(item.id, used + 1)
      return item
    }
  }
  return null
}

function codingWorkQueue(project: Project): Task[] {
  const openComments = project.tasks
    .filter(
      (t) =>
        t.isReviewComment &&
        (t.status === 'open' || t.status === 'in_progress') &&
        t.storyPointsEarned < t.storyPointsRequired,
    )
    .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)

  const available = project.tasks
    .filter(
      (t) =>
        !t.isReviewComment &&
        (t.status === 'open' || t.status === 'in_progress') &&
        !canRefineTask(t) &&
        t.storyPointsEarned < t.storyPointsRequired,
    )
    .sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)

  return [...openComments, ...available]
}

function refineWorkQueue(project: Project): RefineQueueItem[] {
  const requirements = project.requirements
    .filter(canRefineRequirement)
    .sort((a, b) => b.storyPoints - a.storyPoints)
    .map((requirement) => ({ kind: 'requirement' as const, requirement, id: requirement.id }))
  const tasks = project.tasks
    .filter(canRefineTask)
    .sort((a, b) => b.storyPointsRequired - a.storyPointsRequired)
    .map((task) => ({ kind: 'task' as const, task, id: task.id }))
  return [...requirements, ...tasks]
}

function reviewWorkQueue(project: Project): Task[] {
  return project.tasks.filter((t) => t.status === 'pr_ready' && !t.reviewed)
}

export function dispatchCodingTask(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask: number,
  slotsThisTick: Map<string, number>,
): Task | null {
  return dispatchFillFirst(
    project,
    agentId,
    agents,
    'code',
    codingWorkQueue(project),
    maxPerTask,
    slotsThisTick,
  )
}

export function dispatchReviewTask(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask: number,
  slotsThisTick: Map<string, number>,
): Task | null {
  return dispatchFillFirst(
    project,
    agentId,
    agents,
    'review',
    reviewWorkQueue(project),
    maxPerTask,
    slotsThisTick,
  )
}

export function dispatchRefineTarget(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask: number,
  slotsThisTick: Map<string, number>,
): RefineTarget | null {
  const item = dispatchFillFirst(
    project,
    agentId,
    agents,
    'refine',
    refineWorkQueue(project),
    maxPerTask,
    slotsThisTick,
  )
  if (!item) return null
  return item.kind === 'requirement'
    ? { kind: 'requirement', requirement: item.requirement }
    : { kind: 'task', task: item.task }
}

export function dispatchTestTask(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask: number,
  slotsThisTick: Map<string, number>,
): Task | null {
  return dispatchFillFirst(
    project,
    agentId,
    agents,
    'test',
    untestedMergedTasks(project).sort((a, b) => a.storyPointsRequired - b.storyPointsRequired),
    maxPerTask,
    slotsThisTick,
  )
}

export function pickRefineTarget(
  project: Project,
  agents: Agent[],
  agentId: string,
  maxPerTask = 1,
): RefineTarget | null {
  return dispatchRefineTarget(project, agentId, agents, maxPerTask, new Map())
}

export function projectHasRefineWork(project: Project): boolean {
  return project.requirements.some(canRefineRequirement) || project.tasks.some(canRefineTask)
}

/** @deprecated Progress is tick-dispatched; use dispatchableAgents + taskId for display. */
export function agentsOnTaskForJob(
  agents: Agent[],
  projectId: string,
  job: AgentJob,
  taskId: string,
): Agent[] {
  return agents.filter(
    (a) =>
      a.job === job &&
      a.projectId === projectId &&
      a.taskId === taskId &&
      a.status !== 'compacting' &&
      a.status !== 'compacted' &&
      a.status !== 'crashed' &&
      a.status !== 'idle',
  )
}

export function codingAgentsOnTask(task: Task, agents: Agent[]): Agent[] {
  return agentsOnTaskForJob(agents, task.projectId, 'code', task.id)
}

export function reviewersOnTask(task: Task, agents: Agent[]): Agent[] {
  return agentsOnTaskForJob(agents, task.projectId, 'review', task.id)
}

export function repairStaleCodingAssignments(projects: Project[], _agents: Agent[]): Project[] {
  return projects.map((project) => ({
    ...project,
    tasks: project.tasks.map((task) =>
      task.assignedAgentId ? { ...task, assignedAgentId: null } : task,
    ),
  }))
}

/** Reassign duplicate task ids (offline catch-up used to roll back nextId). */
export function repairDuplicateTaskIds(state: GameState): GameState {
  const ctx = ctxFrom(state)

  const projects = state.projects.map((project) => {
    const canonical = new Map<string, number>()
    const tasks = [...project.tasks]

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]!
      const prevIdx = canonical.get(task.id)
      if (prevIdx === undefined) {
        canonical.set(task.id, i)
        continue
      }

      const prev = tasks[prevIdx]!
      if (task.isReviewComment && !prev.isReviewComment) {
        tasks[i] = { ...task, id: uid(ctx, 'task') }
        continue
      }
      if (!task.isReviewComment && prev.isReviewComment) {
        tasks[prevIdx] = { ...prev, id: uid(ctx, 'task') }
        canonical.set(tasks[prevIdx]!.id, prevIdx)
        canonical.set(task.id, i)
        continue
      }

      tasks[i] = { ...task, id: uid(ctx, 'task') }
    }

    return { ...project, tasks }
  })

  return { ...state, projects, nextId: ctx.ids.nextId }
}

export function pickCodingTask(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask = 1,
): Task | null {
  return dispatchCodingTask(project, agentId, agents, maxPerTask, new Map())
}

/** First reviewer dispatched to this PR this tick (roster order). */
export function activeReviewerForTask(task: Task, agents: Agent[]): Agent | undefined {
  return dispatchableAgents(agents, task.projectId, 'review').find((a) => a.taskId === task.id)
}

export function pickReviewTask(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask = 1,
): Task | null {
  return dispatchReviewTask(project, agentId, agents, maxPerTask, new Map())
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

export function createReviewCommentTasks(
  ctx: SimCtx,
  parent: Task,
  reviewHallucinationLevel = 0,
): Task[] {
  const count = reviewCommentSpawnCount(ctx.rng, parent.storyPointsRequired, reviewHallucinationLevel)
  const pool = [...REVIEW_COMMENT_TEXTS]
  const comments: Task[] = []

  for (let i = 0; i < count; i++) {
    const idx = ctx.rng.int(0, pool.length - 1)
    const text = pool.splice(idx, 1)[0] ?? REVIEW_COMMENT_TEXTS[0]
    comments.push({
      ...createTask(ctx, parent.projectId, text, 0.5, 0, parent.id),
      isReviewComment: true,
    })
  }

  return comments
}

function roleWorkQueue(project: Project, job: StaffJob): { id: string }[] {
  switch (job) {
    case 'code':
      return codingWorkQueue(project)
    case 'review':
      return reviewWorkQueue(project)
    case 'refine':
      return refineWorkQueue(project)
    case 'test':
      return untestedMergedTasks(project).sort((a, b) => a.storyPointsRequired - b.storyPointsRequired)
  }
}

export function roleHasDispatchableWork(
  project: Project,
  job: StaffJob,
  agents: Agent[],
  maxPerTask = 1,
): boolean {
  const queue = roleWorkQueue(project, job)
  if (queue.length === 0) return false
  const workers = dispatchableAgents(agents, project.id, job)
  if (workers.length === 0) return true
  const slots = new Map<string, number>()
  for (const worker of workers) {
    switch (job) {
      case 'code':
        if (dispatchCodingTask(project, worker.id, agents, maxPerTask, slots)) return true
        break
      case 'review':
        if (dispatchReviewTask(project, worker.id, agents, maxPerTask, slots)) return true
        break
      case 'refine':
        if (dispatchRefineTarget(project, worker.id, agents, maxPerTask, slots)) return true
        break
      case 'test':
        if (dispatchTestTask(project, worker.id, agents, maxPerTask, slots)) return true
        break
    }
  }
  return false
}

export function projectRoleHasWork(
  project: Project,
  job: StaffJob,
  agentId: string,
  agents: Agent[],
  maxPerTask = 1,
): boolean {
  if (project.status !== 'active') return false
  const agent = agents.find((a) => a.id === agentId)
  if (!agentId || !agent || agent.job !== job || agent.projectId !== project.id) {
    return roleHasDispatchableWork(project, job, agents, maxPerTask)
  }
  const slots = new Map<string, number>()
  switch (job) {
    case 'code':
      return dispatchCodingTask(project, agentId, agents, maxPerTask, slots) !== null
    case 'review':
      return (
        project.tasks.some((t) => t.status === 'pr_ready' && !t.reviewed) &&
        dispatchReviewTask(project, agentId, agents, maxPerTask, slots) !== null
      )
    case 'refine':
      return dispatchRefineTarget(project, agentId, agents, maxPerTask, slots) !== null
    case 'test':
      return projectHasTestWork(project) && dispatchTestTask(project, agentId, agents, maxPerTask, slots) !== null
  }
}

/** Whether staffing +1 on this role would have work to do (UI gate for agent playtests). */
export function roleCanAcceptStaffing(
  project: Project,
  job: AgentJob,
  agents: Agent[],
  maxPerTask = 1,
): boolean {
  if (project.status !== 'active') return false
  if (job === 'conductor') return true
  return projectRoleHasWork(project, job as StaffJob, '', agents, maxPerTask)
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

export function pickTestTask(
  project: Project,
  agentId: string,
  agents: Agent[],
  maxPerTask = 1,
): Task | null {
  return dispatchTestTask(project, agentId, agents, maxPerTask, new Map())
}

export function createBugFixTask(ctx: SimCtx, source: Task): Task {
  return {
    ...createTask(
      ctx,
      source.projectId,
      pickBugDescription(ctx.rng),
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

/** Conductor staffing order — boosts test when merged PRs await QA. */
export function conductorRolePriority(project: Project): StaffJob[] {
  if (projectHasTestWork(project)) {
    return ['refine', 'test', 'code', 'review']
  }
  return CONDUCTOR_ROLE_PRIORITY
}
