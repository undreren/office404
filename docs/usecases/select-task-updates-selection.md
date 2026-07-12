# Select task updates selection

## Given
A playing state with at least one task.

## When
`SelectTask` is dispatched with a task id.

## Then (invariants)
- `selectedTaskId` matches the chosen task
