# Buy GPU upgrade increases GPUs

## Given
Sufficient cash and housing for a GPU upgrade.

## When
The player buys the marketplace GPU upgrade.

## Then (invariants)
- `purchasedGpuUpgrades` includes the upgrade id
- `totalGpus` increases
