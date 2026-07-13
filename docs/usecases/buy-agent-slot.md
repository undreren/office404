# Buy agent slot

## Given
Sufficient cash and housing headroom for another agent slot purchase.

## When
The player buys +1 agent slot.

## Then (invariants)
- `agentSlotPurchases` increases by 1
- `totalAgentSlots` increases
- Cash decreases by `ramSlotCost`
