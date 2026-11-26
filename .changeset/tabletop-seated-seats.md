---
"@edv4h/usketch-plugin-tabletop": patch
---

Seats already on a table's outline stay put when the table lays out again (a seat at a corner no longer jumps to the next edge, and seats on a round table no longer creep). Spreading players starts at the exact middle of the bottom. `createTableWithSeats`, `roomiestSeatPlacement` and `isSeated` are exported; a new player goes where there is the most room.
