# Rep zero spawns crappy leads

## Given
Reputation at 0, no active projects, tutorial complete.

## When
Game time advances until a lead spawns.

## Then (invariants)
- `phase` stays `playing` (no game over at rep 0)
- A lead appears with low `totalStoryPoints` (crappy scope)
