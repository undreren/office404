export const BEST_OF_N_COURSE_ID = 'best_of_n'
export const BEST_OF_N_MAX_TIER = 4

export const VIBE_SLOTS_COURSE_ID = 'vibe_slots'
export const VIBE_SLOTS_MAX_TIER = 4

export const PRODUCT_OWNER_COURSE_ID = 'product_owner'

export const CONDUCTOR_COURSE_ID = 'conductor'

export const REFINEMENT_COURSE_ID = 'refinement'
export const REFINEMENT_MAX_TIER = 3

import type { MetaProgress } from './meta'
import { canAccessProduct } from './product'

export interface VibingCourse {
  id: string
  label: string
  tagline: string
  cost: number
  description: string
  maxTier?: number
}

export const VIBING_COURSES: VibingCourse[] = [
  {
    id: 'prompt_engineering',
    label: 'Prompt Engineering',
    tagline: 'Make no mistakes.',
    cost: 150,
    description: 'Baseline PR quality +15% on every merged task.',
  },
  {
    id: 'context_optimization',
    label: 'Context Optimization',
    tagline: "It's not forgetting — it's prioritizing.",
    cost: 200,
    description: 'Agents fill context 35% slower (×0.65 fill rate) before compacting.',
  },
  {
    id: CONDUCTOR_COURSE_ID,
    label: 'Conductor',
    tagline: 'Someone has to watch them. Might as well be someone fake.',
    cost: 350,
    description:
      'Toggle Conductor per project — auto-staffs refine, code, review, and test (big tasks first). No per-project agent cap. Moves cost 20 tokens.',
  },
  {
    id: REFINEMENT_COURSE_ID,
    label: 'Advanced Refinement',
    tagline: 'Split it once. Maybe twice if the vibes align.',
    cost: 250,
    description:
      'Each tier adds one split round — requirements split once per refine step (0 = one task, 3 = three rounds). Tasks at 1 SP or below never split.',
    maxTier: REFINEMENT_MAX_TIER,
  },
  {
    id: 'project_manager',
    label: 'Project Manager',
    tagline: 'Agile ceremonies, but the stand-up is just you crying.',
    cost: 400,
    description:
      'Toggle on: auto-delivers completed client gigs and enables Conductor on new client projects.',
  },
  {
    id: PRODUCT_OWNER_COURSE_ID,
    label: 'Product Owner',
    tagline: 'Own the backlog. Blame the roadmap.',
    cost: 400,
    description:
      'Toggle on: auto-starts queued in-house features, enables Conductor on new product work, and auto-delivers shipped features for MRR.',
  },
  {
    id: 'sales',
    label: 'Sales Agent',
    tagline: 'Closed-Won Bot 3000.',
    cost: 300,
    description: 'Specialist auto-accepts eligible real leads (and synthetic with prestige).',
  },
  {
    id: 'marketing',
    label: 'Marketing Agent',
    tagline: 'Our funnel is optimized. We do not discuss the funnel.',
    cost: 350,
    description: 'Specialist spawns leads faster and inflates project scopes.',
  },
  {
    id: 'customer',
    label: 'Customer Agent',
    tagline: 'The leads are coming from inside the GPU.',
    cost: 450,
    description: 'Specialist enriches leads, negotiates bonuses, and hallucinates synthetic gigs (stronger with prestige).',
  },
  {
    id: 'accounting',
    label: 'Accounting Agent',
    tagline: 'Creative deductions since Tuesday.',
    cost: 400,
    description: 'Specialist boosts client payments; tax-code windfalls with accounting hallucinations.',
  },
  {
    id: 'procurement',
    label: 'Procurement Agent',
    tagline: 'One-click regret purchases.',
    cost: 275,
    description:
      'Specialist auto-buys any shop upgrade each tick when price ≤10% of cash — housing, RAM, GPU, fine-tunes, and vibing courses (cheapest first). Assign via Status.',
  },
  {
    id: BEST_OF_N_COURSE_ID,
    label: 'Best-of-N',
    tagline: 'Hallucinatory cooperation, real infighting.',
    cost: 400,
    description:
      '+1 max agent on the same task per tier (2 at T1 → 5 at T4). Extra agents on a task produce at ×0.75^n. Conductors spread before stacking.',
    maxTier: BEST_OF_N_MAX_TIER,
  },
  {
    id: VIBE_SLOTS_COURSE_ID,
    label: 'Parallel Vibes',
    tagline: 'Juggle more gigs. Sleep the same amount. Cry the same amount.',
    cost: 500,
    description:
      'Raise your concurrent client gig cap on Status (+1 max per tier, up to T4). Prestige slots stack on top.',
    maxTier: VIBE_SLOTS_MAX_TIER,
  },
  {
    id: 'hot_swapping',
    label: 'Hot Swapping',
    tagline: 'Swap the compacting brain for a fresh one. Like devops, but sadder.',
    cost: 450,
    description:
      'Conductors auto-swap agents that start compacting with a benched agent (lowest context first).',
  },
  {
    id: 'offline',
    label: 'Offline Agent',
    tagline: 'Special relativity, time can be hallucinated.',
    cost: 1000,
    description:
      'Simulates up to 8 hours of elapsed time while away. Specialist auto-assigns when the tab is hidden.',
  },
]

export function vibingCourseCost(course: VibingCourse, tier: number): number {
  return Math.round(course.cost * Math.pow(1.8, tier))
}

export function isVibingCourseVisible(courseId: string, meta: MetaProgress): boolean {
  if (courseId === PRODUCT_OWNER_COURSE_ID) return canAccessProduct(meta)
  return true
}

export function cheapestAffordableVibingCourse(
  vibingCourses: string[],
  vibingCourseTiers: Partial<Record<string, number>>,
  budget: number,
  cash: number,
  meta: MetaProgress,
): { course: VibingCourse; cost: number; newTier: number } | null {
  let best: { course: VibingCourse; cost: number; newTier: number } | null = null
  for (const course of VIBING_COURSES) {
    if (!isVibingCourseVisible(course.id, meta)) continue
    const currentTier =
      vibingCourseTiers[course.id] ?? (vibingCourses.includes(course.id) ? 1 : 0)
    const maxTier = course.maxTier ?? 1
    if (currentTier >= maxTier) continue
    const cost = vibingCourseCost(course, currentTier)
    if (cost <= budget && cash >= cost) {
      if (!best || cost < best.cost) {
        best = { course, cost, newTier: currentTier + 1 }
      }
    }
  }
  return best
}

export function hasVibingCourse(courses: string[], id: string): boolean {
  return courses.includes(id)
}
