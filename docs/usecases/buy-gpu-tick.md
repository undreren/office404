# Buy GPU tick

## Given
Sufficient cash and housing headroom for another GPU tick purchase.

## When
The player buys +1 GPU tick.

## Then (invariants)
- `gpuTickPurchases` increases by 1
- `totalGpuTicks` increases
- Cash decreases by `gpuTickCost`
