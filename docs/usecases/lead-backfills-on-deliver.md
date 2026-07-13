# Lead backfills on deliver

## Given
A playing state with tutorial complete, no available leads, and a deliverable client project.

## When
The player delivers the project.

## Then (invariants)
- At least one lead has status `available`
- No extra lead spawns if the inbox already matches empty client slots
