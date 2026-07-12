# Reject lead changes status

## Given
A playing game state with an available lead.

## When
A player rejects the lead.

## Then (invariants)
- Lead status becomes `rejected`
- Project count is unchanged
