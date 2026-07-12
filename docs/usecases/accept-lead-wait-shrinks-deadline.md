# Accept lead wait shrinks deadline

## Given
An available lead that has been waiting several game days.

## When
The player accepts the lead.

## Then (invariants)
- New project `durationDays` is less than the lead's original `durationDays`
- `daysRemaining` matches the shrunk deadline
