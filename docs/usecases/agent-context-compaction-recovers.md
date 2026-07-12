# Agent context compaction recovers

## Given
A working agent whose context is about to overflow.

## When
Time elapses through compaction and recovery.

## Then (invariants)
- Agent status is no longer `compacting`
- `compactionsSurvived` stat increases by 1
