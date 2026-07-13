# Leads blocked until tutorial done

## Given
Initial playing state with tutorial incomplete.

## When
Time advances with tutorial still incomplete.

## Then (invariants)
- No lead has status `available`
- `tutorialDone` remains false
