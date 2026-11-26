---
"@edv4h/usketch-plugin-presence-activity": minor
---

Export the sender side of `activity.motion`: `buildMotion`, `visitShapes`, `motionStopTimes`, `motionFinalCursor` and `boxCenter`, with configurable hop and tour lengths. A new React-free entry point, `@edv4h/usketch-plugin-presence-activity/motion`, exposes the motion format and these builders, so a server-side agent can publish a cursor tour without loading the plugin. `motionStopTimes` gives when the cursor reaches each stop, so a sender can make each change as the cursor gets there.

The MCP server's old `MAX_MOTION_MS` (2400 ms tour cap) is `DEFAULT_MOTION_TOUR_MS` here; `MAX_MOTION_MS` stays the receivers' 60 s limit, and tours are capped to it.
