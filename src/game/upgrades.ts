export const BEST_OF_N_COURSE_ID = 'best_of_n'
export const BEST_OF_N_MAX_TIER = 9

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
    id: 'conductor',
    label: 'Conductor',
    tagline: 'Someone has to watch them. Might as well be someone fake.',
    cost: 350,
    description: 'Assign a Conductor per project to auto-staff roles within crew cap.',
  },
  {
    id: 'refinement',
    label: 'Advanced Refinement',
    tagline: 'Split it again. And again. Legally distinct tasks.',
    cost: 250,
    description: 'Extra refinement passes to break large tasks down further.',
    maxTier: 3,
  },
  {
    id: 'project_manager',
    label: 'Project Manager',
    tagline: 'Agile ceremonies, but the stand-up is just you crying.',
    cost: 400,
    description: '+1 client project slot. Deadline warnings. Portfolio smarts.',
    maxTier: 3,
  },
  {
    id: 'sales',
    label: 'Sales Agent',
    tagline: 'Closed-Won Bot 3000.',
    cost: 300,
    description: 'Auto-accept real leads matching your rules.',
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
    description: '+1 max agent on the same task per tier. Coders, reviewers, refiners, and testers can pile on.',
    maxTier: BEST_OF_N_MAX_TIER,
  },
]

export function vibingCourseCost(course: VibingCourse, tier: number): number {
  return Math.round(course.cost * Math.pow(1.8, tier))
}

export function hasVibingCourse(courses: string[], id: string): boolean {
  return courses.includes(id)
}
