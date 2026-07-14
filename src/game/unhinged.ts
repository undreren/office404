/** Text derangement scales with lifetime hallucination points earned. */

export type UnhingedTier = 0 | 1 | 2 | 3 | 4 | 5

export function unhingedTier(totalHallucinationsEarned: number): UnhingedTier {
  if (totalHallucinationsEarned >= 50) return 5
  if (totalHallucinationsEarned >= 25) return 4
  if (totalHallucinationsEarned >= 12) return 3
  if (totalHallucinationsEarned >= 5) return 2
  if (totalHallucinationsEarned >= 1) return 1
  return 0
}

const GLITCH_CHARS = '█▓▒░@#$%&*~?'

function positiveMod(value: number, mod: number): number {
  return ((value % mod) + mod) % mod
}

export function derangeText(text: string, tier: UnhingedTier, seed = 0): string {
  if (tier === 0) return text
  if (typeof text !== 'string') return ''
  const rate = tier * 0.04
  const seedU = seed >>> 0
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    const hash = positiveMod(i * 31 + seedU, 100)
    if (ch !== ' ' && hash < rate * 100) {
      out += GLITCH_CHARS[positiveMod(hash, GLITCH_CHARS.length)]!
    } else {
      out += ch
    }
  }
  return out
}

export function unhingedPrefix(tier: UnhingedTier): string {
  switch (tier) {
    case 0:
      return ''
    case 1:
      return '[probably fine] '
    case 2:
      return '[source: internal] '
    case 3:
      return '[verified (uncertain)] '
    case 4:
      return '[HALLUCINATION LIKELY] '
    case 5:
      return '[YOU ARE THE CLIENT] '
  }
}

export function leadsTabLabel(tier: UnhingedTier, available: number, synthetic: number): string {
  if (tier < 3) return `${available} available`
  const verified = Math.max(0, available - synthetic)
  return `${available} available (${verified} verified)`
}
