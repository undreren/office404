export type AgentJob = 'code' | 'review' | 'refine' | 'test' | 'conductor'

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'reviewing'
  | 'refining'
  | 'testing'
  | 'conducting'
  | 'compacting'
  | 'compacted'
  | 'crashed'

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'pr_ready' | 'merged'

export type RequirementStatus = 'open' | 'refined' | 'split'

export type ProjectStatus = 'active' | 'completed' | 'abandoned'

export type LeadStatus = 'available' | 'expired' | 'accepted' | 'rejected'

export type GamePhase = 'playing' | 'won' | 'lost'

export type ApartmentTier = 'cardboard' | 'shared_1br' | 'studio' | 'loft' | 'penthouse'

export type FineTuneRole = 'code' | 'review' | 'refine' | 'test'

export type StaffJob = Exclude<AgentJob, 'conductor'>

export interface ModelDef {
  id: string
  displayName: string
  tagline: string
  parameters: number
  /** Context window in thousands of tokens */
  contextSize: number
  /** RAM consumed per agent at this tier (GB) */
  ramPerAgent: number
  upgradeCost: number
}

export interface ProjectRoleCounts {
  refine: number
  code: number
  review: number
  test: number
  conductor: number
}

export interface Agent {
  id: string
  name: string
  job: AgentJob | null
  taskId: string | null
  projectId: string | null
  jobProgress: number
  jobDuration: number
  status: AgentStatus
  personality: string
  contextUsed: number
  compactingRemainingSec: number
  uptime: number
}

export interface Requirement {
  id: string
  projectId: string
  title: string
  storyPoints: number
  status: RequirementStatus
}

export interface Task {
  id: string
  projectId: string
  /** Requirement this task was refined from (bug fixes inherit from source). */
  requirementId: string | null
  title: string
  storyPointsRequired: number
  storyPointsEarned: number
  complexity: number
  refined: boolean
  status: TaskStatus
  assignedAgentId: string | null
  completedByAgentId: string | null
  parentTaskId: string | null
  /** PR quality 0–100; set at merge. */
  prQuality: number | null
  /** Builds during review; resolved comments add +10%. */
  prQualityStaging: number
  /** Bug roll pending at QA (set at merge). */
  hasUndiscoveredBug: boolean
  bugDiscovered: boolean
  isBugFix: boolean
  sourceTaskId: string | null
  isReviewComment: boolean
  reviewed: boolean
  testStoryPointsEarned: number
}

export interface Project {
  id: string
  clientName: string
  clientTagline: string
  blurb: string
  payment: number
  durationDays: number
  daysRemaining: number
  /** Average merged PR quality — display + rep on delivery. */
  deliveryQuality: number
  testPercent: number
  testStoryPointsRequired: number
  testStoryPointsCompleted: number
  totalStoryPoints: number
  status: ProjectStatus
  requirements: Requirement[]
  tasks: Task[]
  isTutorial: boolean
  lateCount: number
  repPenaltyMultiplier: number
  crewCap: number
  roleCounts: ProjectRoleCounts
  useConductor: boolean
}

export interface Lead {
  id: string
  clientName: string
  clientTagline: string
  blurb: string
  payment: number
  durationDays: number
  totalStoryPoints: number
  daysToExpire: number
  /** gameDay when this lead appeared — used to shrink deadline on late accept. */
  spawnedGameDay: number
  status: LeadStatus
  repRequired: number
}

export interface GameEvent {
  id: string
  timestamp: number
  type: 'crash' | 'client' | 'milestone' | 'system' | 'project' | 'lead'
  message: string
}

export interface GameState {
  phase: GamePhase
  cash: number
  reputation: number
  gameDay: number
  rentDueInDays: number
  apartment: ApartmentTier
  apartmentLeaseRemaining: number
  totalRam: number
  totalGpus: number
  modelTierIndex: number
  purchasedRamUpgrades: string[]
  purchasedGpuUpgrades: string[]
  purchasedFineTunes: string[]
  vibingCourses: string[]
  agents: Agent[]
  projects: Project[]
  leads: Lead[]
  selectedTaskId: string | null
  tutorialDone: boolean
  leadSpawnCooldown: number
  events: GameEvent[]
  stats: {
    projectsCompleted: number
    tasksMerged: number
    agentsDeployed: number
    compactionsSurvived: number
  }
  /** Epoch ms when this snapshot was committed. */
  snapshotAt: number
  /** PRNG seed state — advanced on each random draw. */
  rng: number
  /** Monotonic counter for entity IDs. */
  nextId: number
}
