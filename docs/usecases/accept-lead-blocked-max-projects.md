# Accept lead blocked max projects

## Given
A playing state already at `MAX_ACTIVE_PROJECTS` active projects.

## When
The player tries to accept another lead.

## Then (invariants)
- State is unchanged
- Lead status remains `available`
