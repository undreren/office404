# Bug at QA creates fix task

## Given
A merged task with low PR quality (just-merged) and a staffed tester.

## When
QA completes and the bug roll succeeds.

## Then (invariants)
- A new bug-fix task is created
- Source task `bugDiscovered` is true

## Notes
Pinned RNG seed `1` — just-merge yields `prQuality` 20 and the bug roll succeeds.
