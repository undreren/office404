# Lead expires reduces reputation

## Given
A state with an available lead.

## When
Time elapses past the lead's `daysToExpire`.

## Then (invariants)
- Lead status becomes `expired`
- Reputation decreases by 2
