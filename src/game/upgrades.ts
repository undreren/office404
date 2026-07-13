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
    description: 'Agents write cleaner first drafts — baseline PR quality +15%.',
  },
  {
    id: 'context_optimization',
    label: 'Context Optimization',
    tagline: "It's not forgetting — it's prioritizing.",
    cost: 200,
    description: 'Agents fill context 35% slower before compacting.',
  },
  {
    id: CONDUCTOR_COURSE_ID,
    label: 'Conductor',
    tagline: 'Someone has to watch them. Might as well be someone fake.',
    cost: 350,
    description:
      'Toggle Conductor mode per project — auto-staffs refine, code, review, and test. Caps project crew at 3; each tier adds +1 max agents.',
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
      'Requirement splits cap at one level. Each tier after the first adds +25% auto-split chance when refining.',
    maxTier: REFINEMENT_MAX_TIER,
  },
  {
    id: 'project_manager',
    label: 'Project Manager',
    tagline: 'Agile ceremonies, but the stand-up is just you crying.',
    cost: 400,
    description:
      'Assign up to one Project Manager per extra client gig. Deadline warnings. Portfolio smarts.',
    maxTier: 3,
  },
  {
    id: 'sales',
    label: 'Sales Agent',
    tagline: 'Closed-Won Bot 3000.',
    cost: 300,
    description: 'Auto-accept real leads and auto-deliver completed projects.',
  },
  {
    id: 'marketing',
    label: 'Marketing Agent',
    tagline: 'Our funnel is optimized. We do not discuss the funnel.',
    cost: 350,
    description: 'Faster lead spawn and bigger project scopes.',
  },
  {
    id: 'customer',
    label: 'Customer Agent',
    tagline: 'The leads are coming from inside the GPU.',
    cost: 450,
    description: 'Lead enrichment, negotiate bonuses, synthetic lead psychosis (with hallucinations).',
  },
  {
    id: 'accounting',
    label: 'Accounting Agent',
    tagline: 'Creative deductions since Tuesday.',
    cost: 400,
    description: 'Boost client payments. Hallucinate tax-code windfalls.',
  },
  {
    id: 'procurement',
    label: 'Procurement Agent',
    tagline: 'One-click regret purchases.',
    cost: 275,
    description: 'Auto-buys upgrades costing less than 10% of current cash.',
  },
  {
    id: BEST_OF_N_COURSE_ID,
    label: 'Best-of-N',
    tagline: 'Hallucinatory cooperation, real infighting.',
    cost: 400,
    description: '+1 max agent on the same task per tier (max 5 at tier 4). Coders, reviewers, refiners, and testers can pile on.',
    maxTier: BEST_OF_N_MAX_TIER,
  },
  {
    id: 'offline',
    label: 'Offline Agent',
    tagline: 'Special relativity, time can be hallucinated.',
    cost: 1000,
    description:
      'Game advances while you are away (up to 8 hours). Specialist auto-assigns when the tab is hidden.',
  },
]

export function vibingCourseCost(course: VibingCourse, tier: number): number {
  return Math.round(course.cost * Math.pow(1.8, tier))
}

export function hasVibingCourse(courses: string[], id: string): boolean {
  return courses.includes(id)
}
