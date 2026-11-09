---
"@edv4h/usketch-plugin-character": minor
---

feat(character): 坂への対応。`motion.maxSlope` より急な坂は登れずずり落ちる（段差は今まで通り `maxStep`）、3D ビューでは地面に沿って傾く（`motion.slopeTilt`）、坂でのジャンプは真上と坂の法線の間に跳ぶ（`jump.slopeRatio`）
