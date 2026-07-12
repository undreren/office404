# Hydrate from save restores state

## Given
A serialized game state with known cash and projects.

## When
`HydrateFromSave` is dispatched.

## Then (invariants)
- Cash and project count match the saved snapshot
- `snapshotAt` matches the message timestamp
