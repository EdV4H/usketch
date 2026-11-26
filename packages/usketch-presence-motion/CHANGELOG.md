# @edv4h/usketch-presence-motion

## 0.1.1

### Patch Changes

- d167557: Add a `default` export condition so CommonJS servers can `require()` the package (Node's require of ES modules). Until now only `import` resolved, so a CommonJS caller failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## 0.1.0

### Minor Changes

- ae93f2a: New package `@edv4h/usketch-presence-motion`: the `activity.motion` format and its playback (moved out of presence-activity), plus the sender side that used to live only in the MCP server: `buildMotion`, `visitShapes`, `motionStopTimes`, `motionFinalCursor` and `boxCenter`, with configurable hop and tour lengths. It has no dependencies, so a server-side agent can publish a cursor tour without pulling in the editor. `motionStopTimes` gives when the cursor reaches each stop, so a sender can make each change as the cursor gets there.
  
  presence-activity depends on it and re-exports all of it, so its API only grows. The MCP server's old `MAX_MOTION_MS` (2400 ms tour cap) is `DEFAULT_MOTION_TOUR_MS`; `MAX_MOTION_MS` stays the receivers' 60 s limit, and tours are capped to it.
