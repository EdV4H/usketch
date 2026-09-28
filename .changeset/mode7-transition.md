---
"@edv4h/usketch-plugin-mode7": minor
---

Animated enable/disable transition (#1103). With `transition: { durationMs, easing }`
the ground rises from flat to `camera.pitch` (and yaw) while the sky/fog fade in, and
the reverse on exit — the view stays active until the board is flat again. Toggling
mid-transition reverses from the current state; `prefers-reduced-motion` skips to the
end. Per call: `enable/disable/toggle({ animate })`. New `isTransitioning()` and
`getTransitionAmount()`; `onChange` fires every frame of a transition. Default
`durationMs: 0` keeps the instant switch.
