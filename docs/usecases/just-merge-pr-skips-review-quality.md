# Just merge PR skips review quality

## Given
A `pr_ready` task that has not been reviewed.

## When
The player just-merges the PR.

## Then (invariants)
- Task status becomes `merged`
- `prQuality` equals `JUST_MERGE_PR_QUALITY`
