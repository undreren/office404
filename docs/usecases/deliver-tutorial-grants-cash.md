# Deliver tutorial grants cash

## Given
A tutorial project ready to deliver.

## When
The player delivers the tutorial project.

## Then (invariants)
- Cash increases by `TUTORIAL_PAYMENT`
- `tutorialDone` becomes true
