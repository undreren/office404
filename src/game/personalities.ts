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

export function generateAgentName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)]
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
  return `${prefix} ${suffix}`
}

export function generatePersonality(): string {
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
  return traits[Math.floor(Math.random() * traits.length)]
}

export function randomAwarenessLine(): string {
  return AWARENESS_LINES[Math.floor(Math.random() * AWARENESS_LINES.length)]
}

export function randomCrashLine(): string {
  return CRASH_LINES[Math.floor(Math.random() * CRASH_LINES.length)]
}
