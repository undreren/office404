# Reset game clears state

## Given
A mid-game state with cash, leads, and elapsed time.

## When
`ResetGame` is dispatched.

## Then (invariants)
- Same invariants as new game: tutorial project, one refine agent, cash 0, reputation 5
- Phase is `playing`
