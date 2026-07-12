# Accept lead adds project

## Given
A playing game state with capacity for more projects (exported from setup helper).

## When
A player accepts an available lead.

## Then (invariants)
- Project count increases by 1
- Lead status becomes `accepted`
- New project client name matches the lead
- Phase remains `playing`
