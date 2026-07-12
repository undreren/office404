# Rent due deducts cash

## Given
Initial state with cardboard apartment rent ($40).

## When
30 game days elapse.

## Then (invariants)
- Cash decreases by $40
- `rentDueInDays` resets to approximately 30
