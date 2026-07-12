# Project deadline late applies fee

## Given
An accepted project near its deadline.

## When
Time elapses past `daysRemaining`.

## Then (invariants)
- `lateCount` increases by 1
- Project payment is reduced
- Reputation is reduced
