export type ModelKind = 'local' | 'cloud'

export type AgentJob = 'code' | 'review' | 'refactor' | 'refine' | 'test'

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'reviewing'
  | 'refactoring'
  | 'refining'
  | 'testing'
  | 'compacted'
  | 'crashed'

export type PlayerActionType = 'vibe'

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'pr_ready' | 'merged'

export type RequirementStatus = 'open' | 'refined'

export type ProjectStatus = 'active' | 'completed' | 'abandoned'

export type LeadStatus = 'available' | 'expired' | 'accepted' | 'rejected'

export type GamePhase = 'playing' | 'won' | 'lost'

export type ApartmentTier = 'cardboard' | 'studio' | 'loft' | 'penthouse'

export type RackTier = 'mark_mini' | 'mark_stfu' | 'cuda_cluster'

export interface ModelDef {
  id: string
  name: string
  kind: ModelKind
  vendor?: string
  tagline: string
  parameters: number
  /** Context window in thousands of tokens */
  contextSize: number
  /** Base RAM to load model (GB) */
  loadRam: number
  tokenCostPerTick: number
  purchaseCost: number
  deployCost: number
}

export interface LoadedModel {
  id: string
  modelId: string
  hostId: string
}

export interface Agent {
  id: string
  name: string
  modelId: string
  loadedModelId: string | null
  serverId: string | null
  job: AgentJob | null
  taskId: string | null
  projectId: string | null
  jobProgress: number
  jobDuration: number
  status: AgentStatus
  personality: string
  contextUsed: number
  totalTokensBurned: number
  uptime: number
}

export interface Server {
  id: string
  name: string
  tier: RackTier
  onFire: boolean
  fireDuration: number
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
  title: string
  storyPointsRequired: number
  storyPointsEarned: number
  complexity: number
  refined: boolean
  status: TaskStatus
  assignedAgentId: string | null
  completedByAgentId: string | null
  pendingQualityHit: number
  revealedQualityHit: number | null
  parentTaskId: string | null
  /** Bug introduced at merge; hidden until testing finds it. */
  hasUndiscoveredBug: boolean
  /** Testing agent surfaced this bug. */
  bugDiscovered: boolean
  /** Fix task spawned after a discovered bug. */
  isBugFix: boolean
  /** Merged task this fix addresses. */
  sourceTaskId: string | null
  /** Review nitpick spawned on a PR; resolving reduces merge quality hit. */
  isReviewComment: boolean
  /** PR received its one allowed review pass. */
  reviewed: boolean
}

export interface Project {
  id: string
  clientName: string
  blurb: string
  payment: number
  durationDays: number
  daysRemaining: number
  quality: number
  /** QA progress toward testing the full delivered scope (0–100). */
  testPercent: number
  /** Story points of delivered scope that must be tested (equals original delivery SP). */
  testStoryPointsRequired: number
  /** Story points of QA work completed so far. */
  testStoryPointsCompleted: number
  totalStoryPoints: number
  status: ProjectStatus
  requirements: Requirement[]
  tasks: Task[]
  isTutorial: boolean
  lateCount: number
  repPenaltyMultiplier: number
}

export interface Lead {
  id: string
  clientName: string
  blurb: string
  payment: number
  durationDays: number
  totalStoryPoints: number
  daysToExpire: number
  status: LeadStatus
  repRequired: number
}

export interface PlayerAction {
  type: PlayerActionType
  taskId: string
  progress: number
  duration: number
  forced?: boolean
}

export interface GameEvent {
  id: string
  timestamp: number
  type: 'crash' | 'fire' | 'client' | 'token' | 'milestone' | 'system' | 'project' | 'lead'
  message: string
}

export interface GameState {
  phase: GamePhase
  cash: number
  tokens: number
  maxTokens: number
  sanity: number
  reputation: number
  gameDay: number
  rentDueInDays: number
  apartment: ApartmentTier
  apartmentLeaseRemaining: number
  usedRam: number
  totalRam: number
  ownedLocalModels: string[]
  loadedModels: LoadedModel[]
  servers: Server[]
  agents: Agent[]
  projects: Project[]
  leads: Lead[]
  selectedTaskId: string | null
  playerAction: PlayerAction | null
  tutorialDone: boolean
  leadSpawnCooldown: number
  events: GameEvent[]
  stats: {
    projectsCompleted: number
    tasksMerged: number
    agentsDeployed: number
    compactionsSurvived: number
  }
}

export interface GameActions {
  tick: (deltaSec: number) => void
  selectTask: (taskId: string | null) => void
  startVibe: () => void
  mergePr: (taskId: string) => void
  justMergePr: (taskId: string) => void
  cancelPlayerAction: () => void
  acceptLead: (leadId: string) => void
  rejectLead: (leadId: string) => void
  deliverProject: (projectId: string) => void
  assignAgentToProject: (agentId: string, projectId: string, job: AgentJob) => void
  unassignAgent: (agentId: string) => void
  restartAgent: (agentId: string) => void
  offloadAgent: (agentId: string) => void
  deployCloudAgent: (modelId: string) => boolean
  loadLocalModel: (modelId: string, hostId: string, forceNewInstance?: boolean) => boolean
  spawnLocalAgent: (loadedModelId: string) => boolean
  unloadModel: (loadedModelId: string) => boolean
  buyServer: (tier: RackTier) => boolean
  sellServer: (serverId: string) => boolean
  buyTokens: () => boolean
  upgradeApartment: () => boolean
  extinguishFire: (serverId: string) => boolean
  retire: () => void
  resetGame: () => void
}

export type GameStore = GameState & GameActions
