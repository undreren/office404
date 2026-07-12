# Buy RAM upgrade increases RAM

## Given
Sufficient cash and housing for a RAM upgrade.

## When
The player buys the neighbor's DDR4 upgrade.

## Then (invariants)
- `purchasedRamUpgrades` includes the upgrade id
- `totalRam` increases
