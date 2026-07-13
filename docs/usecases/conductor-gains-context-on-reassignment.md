# Conductor gains context on reassignment

## Given
A project in conductor mode with a staffed conductor and refine work available.

## When
The conductor auto-staffs a worker on the next tick.

## Then (invariants)
- The conductor's `contextUsed` increases by one tick of context fill
- Worker agents are staffed as before
