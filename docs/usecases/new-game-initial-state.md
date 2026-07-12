# New game initial state

## Given
A fresh game with a fixed RNG seed.

## When
`NewGame` is dispatched.

## Then (invariants)
- Phase is `playing`
- Exactly one project exists and it is the tutorial
- Exactly one agent exists, assigned to refine on the tutorial project
- Cash is 0, reputation is 5
- `snapshotAt` matches the message timestamp
- RNG seed is preserved in state
