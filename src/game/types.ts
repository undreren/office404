export type VendorId = 'anthropomorphic' | 'obstinate' | 'precursor'

export type AgentStatus = 'running' | 'crashed' | 'rebooting' | 'philosophizing'

export type GameMode = 'idle' | 'sprinting' | 'zoning'

export interface Vendor {
  id: VendorId
  name: string
  tagline: string
  tokenCostPerSec: number
  deployCost: number
  outputMultiplier: number
  crashChance: number
  stubbornChance: number
}

export interface Agent {
  id: string
  name: string
  vendorId: VendorId
  serverId: string
  status: AgentStatus
  personality: string
  uptime: number
  totalTokensBurned: number
  rebootProgress: number
  philosophizingUntil: number
}

export interface Server {
  id: string
  name: string
  capacity: number
  onFire: boolean
  fireDuration: number
}

export interface GameEvent {
  id: string
  timestamp: number
  type: 'crash' | 'fire' | 'client' | 'token_hike' | 'awareness' | 'milestone' | 'system'
  message: string
}

export interface GameState {
  tokens: number
  maxTokens: number
  sanity: number
  codeProgress: number
  credits: number
  reputation: number
  sprintLevel: number
  servers: Server[]
  agents: Agent[]
  mode: GameMode
  modeTimer: number
  tokenPriceMultiplier: number
  deadlinePressure: number
  totalCodeShipped: number
  lastTickAt: number
  events: GameEvent[]
  stats: {
    agentsDeployed: number
    crashesSurvived: number
    sprintsCompleted: number
    firesExtinguished: number
  }
}

export interface GameActions {
  tick: (deltaSec: number) => void
  applyOfflineProgress: (elapsedSec: number) => void
  deployAgent: (vendorId: VendorId, serverId: string) => boolean
  buyServer: () => boolean
  startSprint: () => void
  startZoning: () => void
  buyTokens: () => boolean
  rebootAgent: (agentId: string) => boolean
  extinguishFire: (serverId: string) => boolean
  resetGame: () => void
}

export type GameStore = GameState & GameActions
