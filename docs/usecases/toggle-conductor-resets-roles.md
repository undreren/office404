# Toggle conductor resets roles

## Given
A project with the Conductor course purchased and mixed role counts.

## When
Conductor mode is enabled on the project.

## Then (invariants)
- `useConductor` is true
- Worker role counts reset to zero and `conductor` is 1
