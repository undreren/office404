export const BEST_OF_N_COURSE_ID = 'best_of_n'
export const BEST_OF_N_MAX_TIER = 4

export const CONDUCTOR_COURSE_ID = 'conductor'
export const CONDUCTOR_MAX_TIER = 4

export const REFINEMENT_COURSE_ID = 'refinement'
export const REFINEMENT_MAX_TIER = 5

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
      'Toggle Conductor per project — auto-staffs refine, code, review, and test. Team cap 3 +1 per tier (max 6 at T4).',
    maxTier: CONDUCTOR_MAX_TIER,
  },
  {
    id: 'auto_conductor',
    label: 'Auto Conductor',
    tagline: 'Every project gets a babysitter. Whether it wants one or not.',
    cost: 275,
    description: 'New client projects start with Conductor mode on (requires Conductor course).',
  },
  {
    id: REFINEMENT_COURSE_ID,
    label: 'Advanced Refinement',
    tagline: 'Split it once. Maybe twice if the vibes align.',
    cost: 250,
    description:
      'Each tier adds +25% auto-split chance when refining requirements (max 100% at T4). Unsplit tasks get that many extra refine passes before coding.',
    maxTier: REFINEMENT_MAX_TIER,
  },
  {
    id: 'project_manager',
    label: 'Project Manager',
    tagline: 'Agile ceremonies, but the stand-up is just you crying.',
    cost: 400,
    description:
      'Assign up to one PM specialist per tier (max 3). Each assigned PM unlocks +1 concurrent client gig and deadline warnings.',
    maxTier: 3,
  },
  {
    id: 'sales',
    label: 'Sales Agent',
    tagline: 'Closed-Won Bot 3000.',
    cost: 300,
    description: 'Specialist auto-accepts real leads and auto-delivers completed client projects.',
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
      'Specialist auto-buys +1 RAM, +1 GPU, or vibing courses each tick when price ≤10% of cash (prefers RAM, then GPU, then cheapest course). Assign via Status.',
  },
  {
    id: BEST_OF_N_COURSE_ID,
    label: 'Best-of-N',
    tagline: 'Hallucinatory cooperation, real infighting.',
    cost: 400,
    description: '+1 max agent on the same task per tier (2 at T1 → 5 at T4). Coders, reviewers, refiners, and testers can pile on.',
    maxTier: BEST_OF_N_MAX_TIER,
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

export function cheapestAffordableVibingCourse(
  vibingCourses: string[],
  vibingCourseTiers: Partial<Record<string, number>>,
  budget: number,
  cash: number,
): { course: VibingCourse; cost: number; newTier: number } | null {
  let best: { course: VibingCourse; cost: number; newTier: number } | null = null
  for (const course of VIBING_COURSES) {
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
