# Retire when eligible

## Given
Cash at or above `personalRetirementThreshold(retirementCount)`.

## When
The player retires.

## Then (invariants)
- Prestige reset applies
- `meta.retirementCount` increments
- `phase` remains `playing`
