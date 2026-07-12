# Reviewer flags PR reviewed

## Given
A project with a `pr_ready` task and a staffed reviewer.

## When
Time elapses for review to complete.

## Then (invariants)
- Task `reviewed` is true
