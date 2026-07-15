# Review takes half coding time

## Given
A `pr_ready` task whose coding tokens are fully earned (`storyPointsEarned` equals code token requirement).

## When
A reviewer is staffed and time elapses for one short tick.

## Then (invariants)
- Task is not yet `reviewed`
- Review progress is less than the review token requirement
