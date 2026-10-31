# @edv4h/usketch-plugin-character

A controllable character for uSketch: place it at a chosen spot on screen, drive it
with customizable keys (WASD by default), keep track of which way it faces, and have
the camera follow it — either keeping the world upright or turning the world with
the character's heading (racing view, via the Core viewport `rotation`). Other
users' characters appear alongside yours through Yjs awareness.

**The plugin draws nothing.** It computes positions and headings and hands them to
your `renderCharacter`, so the look (sprite, car, avatar, labels, animation) is
entirely the host's.

```ts
import { createCharacterPlugin } from "@edv4h/usketch-plugin-character";

createCharacterPlugin({
  renderCharacter: ({ screenHeading, appearance, name }) => (
    <div style={{ transform: `rotate(${screenHeading}deg)`, color: String(appearance.color) }}>▲</div>
  ),
  appearance: { color: "#e44" },   // broadcast, so others draw you the same way
  wsProvider,                      // optional: omit for single-player
  userName: "Alice",
  keys: { up: ["KeyW", "ArrowUp"] }, // KeyboardEvent.code values
  cameraMode: "rotate",            // "fixed" | "rotate" | "free"
  controlScheme: "vehicle",        // "directional" | "vehicle"
  drift: true,                     // vehicle: Space + steer drifts (or tuning overrides)
  jump: true,                      // Space jumps (or tuning overrides)
  renderShadow: ({ altitude }) => <div className="shadow" style={{ scale: 1 / (1 + altitude / 60) }} />,
  screenAnchor: { x: 0.5, y: 0.75 },
});
```

## Concepts

- **Heading**: degrees, `0` = up (world −y), clockwise-positive — the same convention
  as CSS `rotate()` and the viewport `rotation`.
- **Render props**: `heading` (world), `screenHeading` (= `heading + viewport.rotation`,
  what to rotate a top-down sprite by), `moving`, `speed`, `steering`, `slip`,
  `drifting`, `zoom`, `appearance`, `name`, `isSelf`, `id`, `elevation`, `z`, `altitude`,
  `airborne`, `verticalSpeed`. Each character is placed centered on its screen position
  in one screen-space layer, so self and remote characters look the same under zoom
  and camera rotation.
- **Control schemes**
  - `directional` — keys move in screen directions (camera-relative); the heading
    turns toward the movement at `turnRate`. With the `rotate` camera, left/right
    therefore circle (the camera follows the turn).
  - `vehicle` — up/down throttle and reverse, left/right steer. Steering scales
    with speed (a stopped car can't turn) and inverts in reverse. The held steering
    (-1 … 1) is in the pose and render props, e.g. to turn the front wheels.
- **Drift** (`vehicle`, opt-in via `drift`): hold the drift key (Space) and steer at
  speed to start an arcade drift toward the steering. It turns tighter than normal
  steering and slides the body by `slip` degrees (draw the car at `heading + slip`;
  it keeps traveling along `heading`). Steering into the drift tightens it,
  countersteering opens it (never spins). Releasing the key, slowing below
  `stopSpeed` or reversing ends it, and the slip eases back. Tuning (`DriftParams`):
  `startSpeed` / `stopSpeed` (fractions of `moveSpeed`), `turnRate` / `steerRate`
  (multiples of `turnRate`), `slipAngle` / `steerSlipAngle` (degrees), `recoveryRate`
  (1/s). The drift key is only captured while drift is on.
- **Jump** (opt-in via `jump`): press the jump key (Space) to jump. The arc is set by
  its apex `height` (world units) and `timeToApex`; it falls `fallGravity` × faster than
  it rises, releasing the key while rising cuts it short (`releaseCut`), a press within
  `bufferTime` before landing jumps on touchdown, and a jump within `coyoteTime` of
  walking off a ledge still counts. The pose carries the feet height `z` (absolute, like
  the ground height), `vz` and `airborne`. Where the jump key is also the active drift
  key (vehicle + drift, both Space by default) the drift wins. `api.jump()` (and the HUD
  action) jumps from code, as a full jump.
- **Shadow**: pass `renderShadow` to draw a shadow; it is placed on the ground under
  each character while the body stands at its feet height `z`, so under a 3D view
  (Mode 7) a jump lifts the body off its shadow. `altitude` (`z - elevation`) lets it
  shrink as the character rises.
- **Keyboard focus**: movement keys are captured on `window` while the character is
  on, except where the page needs them: nothing is taken while a text field has focus
  or focus is inside a dialog / menu (`dialog`, `role="dialog"`, `alertdialog`, `menu`;
  a dialog that contains the board itself doesn't count), arrow keys are left to
  widgets that use them (range / radio inputs, `role="slider"`, `radio`, `tab`,
  `option`, `combobox`, `menubar` items, `grid`, `treeitem` …) while WASD keeps
  driving, and Space is left to buttons, links and other controls it activates. Focus
  is read through `composedPath()`, so web-component dialogs count too. Moving focus
  to such a target releases the held keys it uses.
- **Camera modes**
  - `fixed` — follow, world stays upright.
  - `rotate` — follow and turn the world by `-heading` (character always faces up).
  - `free` — don't move the camera.

  Panning by hand pauses following; press a movement key to resume. Zooming keeps
  following. Turning the character off turns the camera back upright.
- **Multiplayer**: pass `wsProvider` (anything with a y-protocols `awareness`). Your
  character is published under the `character` awareness field (~20 Hz, only when it
  changes, including `steering`, `slip` and `drifting`) and others are eased between
  updates. It's ephemeral: a character
  vanishes when its owner disconnects or turns it off. Nothing is stored as shapes.
- **Ground height**: when a plugin provides `groundHeightService` (from
  `@edv4h/usketch-shared`, e.g. the map plugin's raised terrain), moving onto
  ground more than `motion.maxStep` (default 24 world units, HUD "登れる段差") higher
  than where the character stands is blocked; it slides along the cliff instead.
  The step is measured from the feet, so mid-jump taller cliffs are reachable; a ledge
  within the step above the feet is landed on. Stepping down within the step snaps
  down; a bigger drop falls (gravity applies even with jumping off). The render props
  carry `elevation` (the ground) and `z` (the feet), and under a 3D view (Mode 7) the
  character is lifted to its feet height.
- **Input**: held keys are tracked from window `keydown`/`keyup` (capture phase,
  `event.code`), swallowed while the character is on so single-letter tool
  shortcuts don't fire. Typing in text fields, and key chords with Ctrl/Cmd/Alt,
  are ignored.

## HUD

A "キャラクター" settings group (on/off, camera, scheme, drift, jump, jump height, speed,
turn rate, climbable step, screen position, camera lag) plus actions to toggle the
character, to place it at the screen position, and to jump.

## Service

```ts
import { getCharacterApi } from "@edv4h/usketch-plugin-character";

const api = getCharacterApi(app.services);
api?.enable();
api?.setCameraMode("rotate");
api?.setRenderer(myRenderer);
api?.setDrift({ slipAngle: 35 }); // true / false / tuning overrides
api?.setJump({ height: 60 });     // true / false / tuning overrides
api?.jump();
api?.setShadowRenderer(myShadow);
api?.getPose(); // { x, y, heading, speed, moving, steering, slip, drift, z, vz, airborne }
```

## Limitations

While the camera is rotated, overlays that compute screen positions themselves
(snap guides, resize handles, connectors, comment badges, the background grid)
are not rotation-aware yet. Tools that go through the Core `screenToWorld` get
correct coordinates.
