# Lead spawns on tutorial complete

## Given
A tutorial project ready to deliver.

## When
The player delivers the tutorial project.

## Then (invariants)
- `tutorialDone` becomes true
- Exactly one lead has status `available`
