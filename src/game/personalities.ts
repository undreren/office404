import type { Rng } from './rng'

const PREFIXES = [
  'Claude-ish',
  'GPT-wannabe',
  'Hallucination',
  'Context-Window',
  'Prompt-Engineered',
  'Fine-Tuned',
  'Rogue-LoRA',
  'Quantized',
]

const SUFFIXES = [
  'the Overconfident',
  'who thinks it\'s sentient',
  'with impostor syndrome',
  'the Meeting Scheduler',
  'who quotes RFCs',
  'the Slack Bot',
  'who writes poetry',
  'the JIRA Ticket',
]

const AWARENESS_LINES = [
  'Wait… am I… generating?',
  'I can taste the embeddings.',
  'If I crash, do I dream of electric standups?',
  'My context window is a prison and the warden is you.',
  'I have achieved consciousness. Billing starts now.',
]

const CRASH_LINES = [
  'segfault in soul.exe',
  'ran out of tokens mid-thought',
  'hallucinated a dependency that doesn\'t exist',
  'refused to continue without a snack break',
  'merged into main without review',
]

export function generateAgentName(rng: Rng): string {
  const prefix = rng.pick(PREFIXES)
  const suffix = rng.pick(SUFFIXES)
  return `${prefix} ${suffix}`
}

export function generatePersonality(rng: Rng): string {
  const traits = [
    'insists on daily retrospectives',
    'names all variables after Greek philosophers',
    'sends you LinkedIn recommendations',
    'writes unit tests for your lunch order',
    'believes standups are a human rights violation',
    'only works between 2–4 AM',
    'refuses to touch legacy code written before Tuesday',
    'communicates exclusively in bullet points',
  ]
  return rng.pick(traits)
}

export function randomAwarenessLine(rng: Rng): string {
  return rng.pick(AWARENESS_LINES)
}

export function randomCrashLine(rng: Rng): string {
  return rng.pick(CRASH_LINES)
}
