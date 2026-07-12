# Merge PR after review

## Given
A reviewed `pr_ready` task.

## When
The player merges the PR.

## Then (invariants)
- Task status becomes `merged`
- `tasksMerged` stat increases by 1
