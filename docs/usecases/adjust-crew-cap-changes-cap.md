# Adjust crew cap changes cap

## Given
An active project with a known crew cap.

## When
`AdjustCrewCap` is dispatched with a positive delta.

## Then (invariants)
- Project `crewCap` increases by the delta amount
