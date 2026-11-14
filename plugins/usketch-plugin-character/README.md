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
  drift: true,                     // vehicle: Shift + steer drifts (or tuning overrides)
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
  `drifting`, `zoom`, `size`, `appearance`, `name`, `isSelf`, `id`, `elevation`, `z`, `altitude`,
  `depth` (how 3D the view is, 0 = flat … 1 = Mode 7), `airborne`, `verticalSpeed`, `hovering`, `hoverGauge` (0 … 1, `null` with hovering
  off), `occluded` (see below). Each character is placed centered on its screen position
  in one screen-space layer, so self and remote characters look the same under zoom
  and camera rotation.
- **Behind the ground** (3D view with terrain): when the board's 3D renderer reports what
  the ground hides (`view3dOcclusionService` in shared, provided by the CSS 3D
  renderer), a character whose middle is behind a hill or a cliff gets `occluded` in its
  render props: `"fade"` (draw it faint; set the opacity on the sprite's faces, since
  opacity on a CSS 3D container flattens it) or `"hide"` (the plugin hides the spot). Its
  flat shadow fades or hides with it. Without a provider it is always `null`.
- **Size** (`size` option / `setSize`, only the look): `size` in the render props is the
  screen px to draw the body at. `{ scale: "screen", value: 36 }` (the default) keeps it
  the same on screen at every zoom, like a map pin. `{ scale: "world", value: 24 }`
  makes it 24 world units, so it scales with the ground (zooming out shrinks it like the
  terrain), kept within `minPx` (default 12) … `maxPx` (default 480) on screen. The
  physics still treat a character as a point: `motion.maxStep` and `jump.height` decide
  what it climbs, not its size.
- **Control schemes**
  - `directional` — keys move in screen directions (camera-relative); the heading
    turns toward the movement at `turnRate`. With the `rotate` camera, left/right
    therefore circle (the camera follows the turn).
  - `vehicle` — up/down throttle and reverse, left/right steer. Steering scales
    with speed (a stopped car can't turn) and inverts in reverse. The held steering
    (-1 … 1) is in the pose and render props, e.g. to turn the front wheels.
- **Drift** (`vehicle`, opt-in via `drift`): hold the drift key (Shift) and steer at
  speed to start an arcade drift toward the steering. It turns tighter than normal
  steering and slides the body by `slip` degrees (draw the car at `heading + slip`;
  it keeps traveling along `heading`). Steering into the drift tightens it,
  countersteering opens it (never spins). Releasing the key, slowing below
  `stopSpeed` or reversing ends it, and the slip eases back. Tuning (`DriftParams`):
  `startSpeed` / `stopSpeed` (fractions of `moveSpeed`), `turnRate` / `steerRate`
  (multiples of `turnRate`), `slipAngle` / `steerSlipAngle` (degrees), `recoveryRate`
  (1/s). With `hop: true`, pressing the drift key on the ground hops `hopHeight`
  (default 10) first, and the drift starts on landing if the key is still held and
  steering (a drift only starts on the ground). The drift key is only captured by a car with drift
  or the air roll (`jump.spinRate`) on, and then not left to the host (e.g. Mode 7's
  Shift = camera down).
- **Jump** (opt-in via `jump`): press the jump key (Space) to jump. The arc is set by
  its apex `height` (world units) and `timeToApex`; it falls `fallGravity` × faster than
  it rises, releasing the key while rising cuts it short (`releaseCut`), a press within
  `bufferTime` before landing jumps on touchdown, and a jump within `coyoteTime` of
  walking off a ledge still counts. The pose carries the feet height `z` (absolute, like
  the ground height), `vz` and `airborne`. Where the jump key is also the active drift
  key (both can be rebound) the drift wins. `api.jump()` (and the HUD
  action) jumps from code, as a full jump.
- **Multi-jump** (`jump.airJumps`, default 0): a fresh press in the air uses one of
  `airJumps` extra jumps while any remain (1 = a double jump); each reaches
  `airJumpRatio` (default 0.8) × `height` (take-off speed × √ratio). They come back on
  landing.
- **Hover** (`jump.hover`, default off; `true` or a partial `HoverParams`): once the air
  jumps are used up (or there are none), holding the jump key while falling fires a
  thrust and drains a gauge that lasts `duration` (1.5 s); an empty gauge falls normally.
  `thrust` is a multiple of gravity (default 0 = a glide): below 1 the character sinks,
  at 1 it keeps its vertical speed, above 1 it climbs for as long as the key is held.
  Sinking is capped at `fallSpeed` (default 15 world units / s, 0 = never sink), climbing
  at `riseSpeed` (60). The gauge refills
  on the ground over `rechargeTime` (0.8 s), not at once on landing. The pose carries
  `hovering` and `hoverGauge` (stays 1 with hovering off); both are broadcast.
- **Air control** (`jump.airControl`, 0 … 1, default 0.5, HUD "空中制御"): how much of
  the ground handling is left in the air. A walk (`directional`) keeps its take-off
  velocity (`pose.moveVx` / `moveVy`) and the keys pull it toward theirs, reaching full
  speed from a stop in `AIR_CONTROL_TIME` (0.1 s) / `airControl`; releasing them slows it
  the same way. A car keeps its speed (no throttle or brakes in the air) and steers at
  `airControl` × the ground's, its travel turning with it; a running drift carries on. 0
  = ballistic (the take-off velocity carries the jump, a car can't steer), 1 = as on the
  ground. Falls with jumping off use the default.
- **Air attitude** (vehicle, `jump.spinRate`, default 270 °/s, 0 = off, HUD "空中で車体を回す速さ"):
  in the air, with the drift key held, the throttle keys pitch the body (forward = nose
  down, back = nose up) and the steering rolls it (right = right side down) instead of
  yawing it (`stepAirSpin` / `holdSteerForRoll`). The spin has weight: `jump.spinInertia`
  (default 0.3 s, 0 = none, HUD "車体の回転の慣性") is how long it takes to build up to
  `spinRate`, and a released spin slows to a stop over the same time (`pose.pitchRate` /
  `rollRate`); with 0 the body turns only while a key is held. A full flip wraps back to
  level. The pose and render props carry `pitch` / `roll` (degrees,
  0 on the ground; broadcast). On touchdown (`landVehicle`) the body is set back on its
  wheels: tilted at most `landingTolerance` (default 35°, HUD "着地の許容角") from the
  ground under it (`landingTilt`, slopes included) it drives on, beyond that it keeps
  only `crashSpeed` (default 0.3, HUD "着地失敗で残る速さ") of its speed.
- **Keys**: the keys are `"hold"` bindings in the app's keymap (`CHARACTER_KEY_IDS`:
  `usketch-plugin-character:up` / `down` / `left` / `right` / `drift` / `jump`), with the
  plugin's `keys` as their defaults, so hosts can also set them with
  `createApp({ keymap: { keys } })` and overlaps with other plugins' keys show up in
  `keymap.getConflicts()`. While the character is on they sit above tool shortcuts and
  Mode 7's camera height keys (`CHARACTER_KEY_PRIORITY`; movement, then drift, then
  jump), and a key the keymap gives elsewhere is left alone. The jump (Space) and the
  drift (Shift) have their own keys. Viewers rebind them in the app's shared "キー設定"
  panel (`usketch-plugin-key-settings`), which saves them; this plugin's own key panel
  is gone. Keys a viewer saved with it (`usketch-plugin-character:keys`) are carried
  into the keymap once and the old entry removed. Deprecated (removed in the next
  major): `saveKeys`, `setKeys`'s `save` option, `captureNextKey`, and the
  `character-keys.ts` helpers (`bindKey`, `unbindKey`, `canBindKey`, `keyLabel`,
  `parseStoredKeys` …). `setKeys` / `getKeys` / `getDefaultKeys` / `resetKeys` /
  `onKeysChange` work on the keymap's bindings.
- **Standing up in 3D**: each spot (and the wrapper around the renderer's content) keeps
  the 3D context (`transform-style: preserve-3d`), so under a 3D view (Mode 7) a
  renderer can stand a flat sprite up out of the tilted ground instead of having it lie
  on it: read the drawn camera from `view3dService` (`@edv4h/usketch-shared`) and turn
  the sprite by `rotateX(-pitch)` around its bottom edge (`transform-origin: bottom`).
  On the flat board `pitch` is 0, so the same renderer draws top-down there.
- **Shadow**: pass `renderShadow` to draw a shadow; it is placed on the ground under
  each character while the body stands at its feet height `z`, so under a 3D view
  (Mode 7) a jump lifts the body off its shadow. `altitude` (`z - elevation`) lets it
  shrink as the character rises.
- **Jumping on the flat board**: height can't be seen top-down, so there the layer lifts
  an airborne body up the screen by `altitude × zoom × motion.flatLift` px (default 0.6,
  0 … 3, HUD "ジャンプで画面上に浮かせる（2D）") and grows it a little
  (`1 + altitude × 0.004`, at most ×1.5); the shadow stays at the feet. Both fade out
  with the 3D transition, so in Mode 7 the body rises for real instead
  (`flatJumpLift`). Renderers need nothing extra.
- **Keyboard focus**: movement keys are captured on `window` while the character is
  on, except where the page needs them: nothing is taken while a text field has focus
  or focus is inside a dialog / menu (`dialog`, `role="dialog"`, `alertdialog`, `menu`;
  a dialog that contains the board itself doesn't count), arrow keys are left to
  widgets that use them (range / radio inputs, `role="slider"`, `radio`, `tab`,
  `option`, `combobox`, `menubar` items, `grid`, `treeitem` …) while WASD keeps
  driving, and Space is left to buttons, links and other controls it activates. Focus
  is read through `composedPath()`, so web-component dialogs count too. Moving focus
  to such a target releases the held keys it uses.
- **Touch / gamepad (virtual input)**: a host control feeds analog input with
  `api.setVirtualInput({ throttle, steer, drift })` (`throttle` / `steer` in -1 … 1;
  `directional` reads them as screen up / right). Send the current state on every
  change and `null` on release. It adds to the held keys (capped at ±1), so keyboard
  and stick can drive together; a partial `throttle` aims for that fraction of the top
  speed and a partial `steer` turns by that fraction. Touching it resumes a paused
  follow camera like a movement key. It is ignored while the character is off, and
  turning the character off releases it. `jump: true` is the jump button: held like the
  jump key (release while rising for a short hop, hold in a fall to hover), and a press
  between two frames still counts. A `drift` press also starts a drift hop when
  `drift.hop` is on.
- **Camera modes**
  - `fixed` — follow, world stays upright.
  - `rotate` — follow and turn the world by `-heading` (character always faces up).
  - `free` — don't move the camera.

  Panning by hand pauses following; press a movement key to resume. Zooming keeps
  following. Turning the character off turns the camera back upright.

  Under a 3D view (Mode 7) the follow also raises the view's camera with the character
  (eased; `view3dService.setCameraHeight`), so climbing a mountain doesn't walk the
  character out of the top of the screen. On the ground it follows the feet; in the air
  it holds the take-off height, so an ordinary jump still rises on screen and running off
  a ledge over a pit doesn't dip the view. A hover or a high multi-jump that climbs more
  than `cameraHeightMargin` above the take-off height (default = the jump's height) drags
  the camera up with it, and a fall below the take-off height takes it down. `0` follows
  the body's height exactly (`setCameraHeightMargin` at runtime).
- **Multiplayer**: pass `wsProvider` (anything with a y-protocols `awareness`). Your
  character is published under the `character` awareness field (~20 Hz, only when it
  changes, including `steering`, `slip`, `drifting` and the control scheme — the
  render props' `controlScheme`, e.g. to draw a car for `"vehicle"`) and others are eased between
  updates. It's ephemeral: a character
  vanishes when its owner disconnects or turns it off. Nothing is stored as shapes.
- **Ground height**: read from the board's height (`ctx.height`, or `boardHeight` from
  `@edv4h/usketch-shared`) when a plugin registers a ground there (e.g. the map
  plugin's raised terrain, the elevation field), moving onto
  ground more than `motion.maxStep` (default 24 world units, HUD "登れる段差") higher
  than where the character stands is blocked; it slides along the cliff instead.
  The step is measured from the feet, so mid-jump taller cliffs are reachable; a ledge
  within the step above the feet is landed on. Stepping down within the step snaps
  down; a bigger drop falls (gravity applies even with jumping off). The render props
  carry `elevation` (the ground) and `z` (the feet), and under a 3D view (Mode 7) the
  character is lifted to its feet height.
- **Solids**: when a plugin registers a solid on the board's height (e.g. shape-3d's
  shapes with a `collision`), the highest one is combined with the ground: a wall (`Infinity`) blocks
  every move into it (sliding along it like a cliff), and a finite top is a ledge that
  is stepped or jumped onto and stood on (`blockingHeight` / `standingHeight`). A move
  is checked in stretches of at most `SWEEP_STEP` (4) world units (`sweepToGround`), so
  a fast character or vehicle can't skip a thin wall within one frame.
- **Slopes**: on smooth ground (e.g. the elevation plugin's hills) the step alone never
  binds, so `motion.maxSlope` (degrees, default 0 = no limit, HUD "登れる坂の角度")
  limits the slope walked UP; steeper ground blocks like a cliff, and standing on it
  slides down (`slideOnSteep`, half the move speed). The slope is measured with a
  minmod over ±8 world units (`groundSlope`), so a step — the map's flat terrain
  levels, a box's edge — reads as flat and stays `maxStep`'s business. In the air the
  limit doesn't apply (jump up it).
- **Jumping off a slope** leaves between straight up and the ground's normal:
  `jump.slopeRatio` (0 = up, 1 = the normal, default 0.5, HUD "坂でのジャンプの向き").
  The sideways part (`pose.vx` / `vy`) carries through the air (`pushInAir`) and is
  dropped on landing. Air jumps and the drift hop go straight up.
- **Leaning**: under a 3D view (Mode 7) the layer lays each character (and its shadow)
  along the ground under it, by `motion.slopeTilt` (0 … 1, default 1, HUD
  "坂に合わせて傾ける") × the 3D transition (`slopeTiltTransform`). In the air the
  body's lean fades out over the first `AIR_LEAN_FADE` world units above the ground
  (`bodyLeanFactor`), so terrain passing below a jump or a hover doesn't tilt it; the
  shadow still lies along the ground. The flat board is unchanged.
- **Input**: held keys are tracked from window `keydown`/`keyup` (capture phase,
  `event.code`), swallowed while the character is on so single-letter tool
  shortcuts don't fire. Typing in text fields, and key chords with Ctrl/Cmd/Alt,
  are ignored.

## HUD

A "キャラクター" settings group (on/off, camera, scheme, drift, drift key, drift hop, jump, jump key, jump height, air
jumps, jump direction on slopes, air control, air spin rate, spin inertia, landing tolerance, crash speed, hover, hover time, hover thrust, speed, turn rate, climbable step, climbable slope, lean on slopes, size and its scale, screen position, camera lag) plus actions to toggle the
character, to place it at the screen position, and to jump.

## Service

```ts
import { getCharacterApi } from "@edv4h/usketch-plugin-character";

const api = getCharacterApi(app.services);
api?.enable();
api?.setCameraMode("rotate");
api?.setRenderer(myRenderer);
api?.setDrift({ slipAngle: 35, hop: true }); // true / false / tuning overrides
api?.setJump({ height: 60 });     // true / false / tuning overrides
api?.setJump({ airJumps: 1, hover: { duration: 2 } }); // double jump + hover (hover: true / false / partial)
api?.jump();
api?.setKeys({ ...api.getKeys(), drift: ["KeyX"] }); // KeyboardEvent.code values
api?.setShadowRenderer(myShadow);
api?.setSize({ scale: "world", value: 24, minPx: 20 }); // scale with the ground (render props `size`)
api?.getPose(); // { x, y, heading, speed, moving, steering, slip, drift, z, vz, airborne, hovering, hoverGauge }
api?.setVirtualInput({ throttle: 0.8, steer: -0.3 }); // touch stick; null on release
api?.setVirtualInput({ throttle: 0.8, steer: 0, jump: true }); // + jump button held
```

## Limitations

While the camera is rotated, overlays that compute screen positions themselves
(snap guides, resize handles, connectors, comment badges, the background grid)
are not rotation-aware yet. Tools that go through the Core `screenToWorld` get
correct coordinates.
