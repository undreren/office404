# Upgrade model tier no-op

## Given
Any playing state.

## When
The player tries to upgrade model tier with cash.

## Then (invariants)
- State is unchanged (model tier upgrades are hallucination-only)
