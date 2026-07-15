# Conductor staffs without workers

## Given
A project with the Conductor course purchased, pipeline work available, and no staffed workers.

## When
Conductor mode is enabled and an unassigned roster agent is available.

## Then (invariants)
- A conductor agent is assigned to the project immediately
- The conductor can auto-staff workers on subsequent ticks
