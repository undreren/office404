# Tasks merged increments stat

## Given
A reviewed `pr_ready` task.

## When
The player merges the PR.

## Then (invariants)
- `stats.tasksMerged` increases by 1
