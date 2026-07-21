# @edv4h/usketch-plugin-timter

Shared timers as **canvas shapes** (single source of truth). A `timer` shape is
placeable/movable and syncs through the normal shapes map; timing runs against a
shared `ServerClock` so every user agrees on "now". The plugin also surfaces
every timer in the Debug HUD's Controls dock (group "Timter").

The domain model (`timer-model`) is pure, framework-free, and time-source
agnostic — every function takes an explicit `serverNow`.

## Install

```ts
import { createTimterPlugin } from "@edv4h/usketch-plugin-timter";

const timter = createTimterPlugin({
  serverClock, // your shared ServerClock
  userId,      // optional, attribution (reserved)
});
```

## Customizing the shape's look — `renderShape`

By default the timer renders with a built-in visual. To match your own design
(hand-drawn theme, design tokens, custom controls), pass a `renderShape`
render-prop. It receives the shape, its live `TimerCore`, a fresh `serverNow`
(recomputed on every self-tick while running), and the timer `actions`. The
plugin owns the tick and the store writes — your renderer only draws and calls
actions.

```tsx
import {
  createTimterPlugin,
  displayMs,
  formatDuration,
  isDone,
} from "@edv4h/usketch-plugin-timter";

createTimterPlugin({
  serverClock,
  renderShape: ({ shape, core, serverNow, actions }) => (
    <div className="my-timer" data-done={isDone(core, serverNow)}>
      <span className="my-timer__time">
        {formatDuration(displayMs(core, serverNow))}
      </span>
      <button type="button" onClick={actions.toggle}>
        {shape.running ? "pause" : "start"}
      </button>
      <button type="button" onClick={actions.reset}>reset</button>
    </div>
  ),
});
```

`actions`:

| action | effect |
| --- | --- |
| `toggle()` | start if paused, pause if running |
| `reset()` | back to the configured, stopped state |
| `switchType()` | advance to the next registered kind (paused only) |
| `adjust(deltaMs)` | change the configured duration by `deltaMs` (duration-based kinds, paused only) |

> Buttons should call `e.stopPropagation()` on `onPointerDown` so the click
> doesn't start a canvas drag — see `defaultRenderTimerShape` for the pattern.

### Extend, don't replace

`defaultRenderTimerShape` is exported, so you can wrap the built-in visual
instead of rewriting it:

```tsx
import { defaultRenderTimerShape } from "@edv4h/usketch-plugin-timter";

createTimterPlugin({
  serverClock,
  renderShape: (ctx) => (
    <div className="my-frame">{defaultRenderTimerShape(ctx)}</div>
  ),
});
```

## Adding a timer type — `registerTimerKind`

`countdown` and `stopwatch` are built in. Register your own kind (e.g.
`pomodoro`) once at startup; the model transitions, the shape renderer, and the
Controls dock all treat it like a built-in. `switchType()` cycles through every
registered kind.

```ts
import { registerTimerKind, TIMER_KINDS } from "@edv4h/usketch-plugin-timter";

registerTimerKind("pomodoro", {
  ...TIMER_KINDS.countdown, // reuse countdown transitions
  icon: "🍅",
  // always a 25-minute work block
  initial: () => ({ anchorAt: null, accumMs: 25 * 60_000, durationMs: 25 * 60_000 }),
});
```

A `TimerKind` defines pure transitions over `TimerCore`:

```ts
interface TimerKind {
  icon?: string; // glyph used by the built-in renderer / Controls dock
  displayMs(c, serverNow): number;
  isDone(c, serverNow): boolean;
  onStart(c, serverNow): Pick<TimerCore, "anchorAt" | "accumMs">;
  onPause(c, serverNow): Pick<TimerCore, "anchorAt" | "accumMs">;
  initial(durationMs): Pick<TimerCore, "anchorAt" | "accumMs" | "durationMs">;
}
```

## Model exports

`start` · `pause` · `reset` · `initialCore` · `displayMs` · `isDone` ·
`formatDuration` · `getTimerKind` · `timerTypes` · `registerTimerKind` ·
`TIMER_KINDS` — plus types `TimerCore` · `TimerType` · `TimerKind`.

Shape exports: `TIMER_SHAPE_TYPE` · `TimerShapeData` · `defaultRenderTimerShape`
· `makeTimerShape` · `dispatchTimerShapeAction` — plus types
`TimerShapeRenderer` · `TimerRenderContext` · `TimerShapeActions`.
