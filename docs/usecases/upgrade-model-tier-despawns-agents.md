# Upgrade model tier despawns agents

## Given
Sufficient cash, RAM, and deployed agents.

## When
The player upgrades the model tier.

## Then (invariants)
- `modelTierIndex` increases by 1
- All agents are despawned
