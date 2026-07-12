# Leads blocked until tutorial done

## Given
Initial playing state with tutorial incomplete.

## When
The lead spawn cooldown elapses.

## Then (invariants)
- No lead has status `available`
- `tutorialDone` remains false
