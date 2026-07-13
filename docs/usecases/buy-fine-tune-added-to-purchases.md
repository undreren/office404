# Buy fine tune added to purchases

## Given
$90 cash on the current model tier.

## When
The player buys the code fine-tune for tier 0 (level 1).

## Then (invariants)
- `purchasedFineTunes` includes `tune-0-code`
- `fineTuneTiers['tune-0-code']` is `1`
- Cash decreases by $90
