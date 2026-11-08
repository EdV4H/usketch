---
"@edv4h/usketch-plugin-shape-freedraw": minor
---

線の端を、同じペンの近くの線へつなげるようにした（`endpointSnap`、既定は無効。実行時は `freedraw:set-endpoint-snap` で切り替え、Ctrl / ⌘ を押しながら離すとその線だけ逆）。手を離したとき、始点・終点が近くの線に入っていれば、その線のいちばん近い点まで伸ばし、つないだ端を shape の `joins` に残す。足したペンは `snapDistance(size)` でつなぐ距離を決められ、`finalize` が `snapEnds: false` を返した線はつながない。
