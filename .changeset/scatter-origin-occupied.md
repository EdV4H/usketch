---
"@edv4h/usketch-plugin-scatter": minor
---

`scatter()` can now start from a bare point: `origin: { point, radius? }` (used when no `seedId` is given; pattern sees `seedCenter = point` and `seedBounds` = the circle's box). `occupiedIn` (a box, queried through the store's spatial index) and `occupiedFilter` (a predicate) narrow `PatternContext.occupied`, so a tool can avoid only the shapes around where it scatters and let items land on frames or backgrounds. Existing calls behave as before.
