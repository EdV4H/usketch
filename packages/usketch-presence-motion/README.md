# @edv4h/usketch-presence-motion

The `activity.motion` awareness value from presence activity (#960): one value that
describes a continuous movement ("the cursor glides to A, selects it, glides to B,
edits it"), so it costs a single awareness update and every receiver plays it back
smoothly on its own clock.

No dependencies and no React, so a server or a bot can use it as well as the editor.

- **Receivers**: `normalizeMotion` (validate untrusted peer data), `sampleMotion`
  (the frame at a time), `createMotionClock` (per-receiver playback clock).
  `@edv4h/usketch-plugin-presence-activity` draws it.
- **Senders**: `visitShapes` (stops that visit shapes in order),
  `buildMotion` (the motion through those stops), `motionStopTimes` (when the
  cursor reaches each stop, to make each change as it gets there) and
  `motionFinalCursor` (where the cursor rests afterwards).

```ts
import { buildMotion, motionStopTimes, visitShapes } from "@edv4h/usketch-presence-motion";

const stops = visitShapes(created.map((s) => ({ id: s.id, box: s })));
const motion = buildMotion({ id: crypto.randomUUID(), stops, from: lastCursor });
awareness.setLocalStateField("activity", { shapeIds: [], action: "edit", label: "AI", motion });
motionStopTimes(stops, { from: lastCursor }).forEach((at, i) =>
	setTimeout(() => doc.transact(() => shapes.set(created[i].id, created[i])), at),
);
```
