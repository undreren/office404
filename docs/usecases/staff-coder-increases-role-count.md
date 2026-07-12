# Staff coder increases role count

## Given
A project with a refine agent that can be reassigned.

## When
Refine is unstaffed and a coder is staffed.

## Then (invariants)
- Project `roleCounts.code` increases by 1
