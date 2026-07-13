import type { MetaProgress } from './meta'

export type AgentJob =
  | 'code'
  | 'review'
  | 'refine'
  | 'test'
  | 'conductor'
  | 'procurement'
  | 'sales'
  | 'marketing'
  | 'customer'
  | 'accounting'
  | 'project_manager'

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'reviewing'
  | 'refining'
  | 'testing'
  | 'conducting'
  | 'procuring'
  | 'selling'
  | 'marketing'
  | 'accounting'
  | 'managing'
  | 'compacting'
  | 'compacted'
  | 'crashed'

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'pr_ready' | 'merged'

export type RequirementStatus = 'open' | 'refined' | 'split'

export type ProjectStatus = 'active' | 'completed' | 'abandoned'

export type ProjectKind = 'client' | 'product' | 'tax_code'

export type LeadStatus = 'available' | 'accepted' | 'rejected'

export type LeadSource = 'real' | 'synthetic'

export type GamePhase = 'playing' | 'singularity'

export type MainTabId = 'status' | 'shop' | 'projects' | 'leads' | 'product' | 'hallucinations'

export type ApartmentTier =
  | 'cardboard'
  | 'shared_1br'
  | 'studio'
  | 'loft'
  | 'penthouse'
  | 'campus'
  | 'regional_dc'
  | 'hyperscale_campus'
  | 'continental_grid'
  | 'planetary_backbone'
  | 'orbital_ring'
  | 'dyson_swarm'
  | 'dyson_sphere'

export type FineTuneRole = 'code' | 'review' | 'refine' | 'test'

export type StaffJob = Exclude<AgentJob, 'conductor' | 'procurement' | 'sales' | 'marketing' | 'customer' | 'accounting' | 'project_manager'>

export type HallucinationLevels = Partial<Record<string, number>>

export interface ModelDef {
  id: string
  displayName: string
  tagline: string
  parameters: number
  /** Context window in thousands of tokens */
  contextSize: number
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
  /** Automation agents only — not spawned workers */
  isAutomation?: boolean
}

export interface Requirement {
  id: string
  projectId: string
  title: string
  storyPoints: number
  status: RequirementStatus
  /** Extra refinement passes used on this requirement */
  refinePassesUsed?: number
  /** Saved refine progress when no agent is staffed on this requirement */
  refineJobProgress?: number
  refineJobDuration?: number
}

export interface Task {
  id: string
  projectId: string
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
  prQuality: number | null
  prQualityStaging: number
  hasUndiscoveredBug: boolean
  bugDiscovered: boolean
  isBugFix: boolean
  sourceTaskId: string | null
  isReviewComment: boolean
  reviewed: boolean
  testStoryPointsEarned: number
  /** Saved review progress when no reviewer is staffed on this PR */
  reviewJobProgress?: number
  reviewJobDuration?: number
  /** Refinement splits remaining for this task */
  refinePassesRemaining?: number
}

export interface Project {
  id: string
  clientName: string
  clientTagline: string
  blurb: string
  payment: number
  durationDays: number
  daysRemaining: number
  deliveryQuality: number
  testPercent: number
  testStoryPointsRequired: number
  testStoryPointsCompleted: number
  totalStoryPoints: number
  status: ProjectStatus
  requirements: Requirement[]
  tasks: Task[]
  isTutorial: boolean
  kind: ProjectKind
  lateCount: number
  repPenaltyMultiplier: number
  crewCap: number
  roleCounts: ProjectRoleCounts
  useConductor: boolean
  /** PM hallucination: completing this also completes duplicateProjectId */
  duplicateProjectId: string | null
  /** Synthetic client project — may ghost */
  isSynthetic?: boolean
  mrrContribution: number
}

export interface Lead {
  id: string
  clientName: string
  clientTagline: string
  blurb: string
  payment: number
  durationDays: number
  totalStoryPoints: number
  spawnedGameDay: number
  status: LeadStatus
  repRequired: number
  source: LeadSource
  /** Estimated $/SP for customer agent UI */
  estimatedDollarsPerSp?: number
  ghostRisk?: number
}

export interface ProductBacklogItem {
  id: string
  title: string
  storyPoints: number
  cost: number
  status: 'queued' | 'active' | 'shipped'
}

export interface GameEvent {
  id: string
  timestamp: number
  type: 'crash' | 'client' | 'milestone' | 'system' | 'project' | 'lead' | 'product' | 'hallucination'
  message: string
}

export interface GameState {
  meta: MetaProgress
  phase: GamePhase
  cash: number
  reputation: number
  gameDay: number
  rentDueInDays: number
  apartment: ApartmentTier
  apartmentLeaseRemaining: number
  /** Purchased +1 agent slot upgrades */
  agentSlotPurchases: number
  /** Purchased +1 GPU tick upgrades */
  gpuTickPurchases: number
  mrr: number
  productFeaturesShipped: number
  purchasedFineTunes: string[]
  vibingCourses: string[]
  /** Per-course tier for multi-level vibing (e.g. refinement, PM) */
  vibingCourseTiers: Partial<Record<string, number>>
  agents: Agent[]
  projects: Project[]
  productBacklog: ProductBacklogItem[]
  leads: Lead[]
  selectedTaskId: string | null
  tutorialDone: boolean
  seenStoryIntro: boolean
  acknowledgedTutorialStep: number
  seenTabIntros: MainTabId[]
  seenCompactionIntro: boolean
  syntheticLeadCooldown: number
  taxCodeCooldown: number
  events: GameEvent[]
  stats: {
    projectsCompleted: number
    tasksMerged: number
    agentsDeployed: number
    compactionsSurvived: number
    productsShipped: number
    syntheticLeadsAccepted: number
  }
  snapshotAt: number
  rng: number
  nextId: number
}

export interface PersistedSave {
  version: number
  meta: MetaProgress
  state: GameState
}

export type { MetaProgress }
