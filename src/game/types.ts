export type ModelKind = 'local' | 'cloud'

export type AgentStatus = 'idle' | 'working' | 'compacted' | 'crashed'

export type PlayerActionType = 'sprint' | 'vibe' | 'review' | 'refine' | 'refactor'

export type TaskStatus = 'open' | 'in_progress' | 'pr_ready' | 'merged'

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
  taskId: string | null
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
  parentTaskId: string | null
}

export interface Project {
  id: string
  clientName: string
  blurb: string
  payment: number
  durationDays: number
  daysRemaining: number
  quality: number
  totalStoryPoints: number
  status: ProjectStatus
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
  reviewRevealedHit: number | null
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
  startSprint: () => void
  startVibe: () => void
  startRefine: (taskId: string) => void
  startRefactor: (taskId: string) => void
  startReview: (taskId: string) => void
  justMerge: (taskId: string) => void
  completeMerge: (taskId: string) => void
  cancelPlayerAction: () => void
  acceptLead: (leadId: string) => void
  rejectLead: (leadId: string) => void
  assignAgent: (agentId: string, taskId: string) => void
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
