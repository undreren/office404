# Prestige retire grants hallucinations

## Given
Cash at or above `personalRetirementThreshold(retirementCount)`.

## When
The player retires.

## Then (invariants)
- `phase` stays `playing` (prestige reset, not game over)
- `meta.retirementCount` increases
- `meta.hallucinationPoints` increases when new ladder rungs are cleared
- Run resets without tutorial
