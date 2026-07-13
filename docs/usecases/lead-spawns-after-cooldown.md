# Lead spawns when pipeline has room

## Given
Initial playing state with tutorial complete, no active client projects, and no leads.

## When
Time advances.

## Then (invariants)
- At least one lead has status `available`
