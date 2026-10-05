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
  screenAnchor: { x: 0.5, y: 0.75 },
});
```

## Concepts

- **Heading**: degrees, `0` = up (world −y), clockwise-positive — the same convention
  as CSS `rotate()` and the viewport `rotation`.
- **Render props**: `heading` (world), `screenHeading` (= `heading + viewport.rotation`,
  what to rotate a top-down sprite by), `moving`, `speed`, `zoom`, `appearance`,
  `name`, `isSelf`, `id`. Each character is placed centered on its screen position
  in one screen-space layer, so self and remote characters look the same under zoom
  and camera rotation.
- **Control schemes**
  - `directional` — keys move in screen directions (camera-relative); the heading
    turns toward the movement at `turnRate`. With the `rotate` camera, left/right
    therefore circle (the camera follows the turn).
  - `vehicle` — up/down throttle and reverse, left/right steer. Steering scales
    with speed (a stopped car can't turn) and inverts in reverse.
- **Camera modes**
  - `fixed` — follow, world stays upright.
  - `rotate` — follow and turn the world by `-heading` (character always faces up).
  - `free` — don't move the camera.

  Panning by hand pauses following; press a movement key to resume. Zooming keeps
  following. Turning the character off turns the camera back upright.
- **Multiplayer**: pass `wsProvider` (anything with a y-protocols `awareness`). Your
  character is published under the `character` awareness field (~20 Hz, only when it
  changes) and others are eased between updates. It's ephemeral: a character
  vanishes when its owner disconnects or turns it off. Nothing is stored as shapes.
- **Input**: held keys are tracked from window `keydown`/`keyup` (capture phase,
  `event.code`), swallowed while the character is on so single-letter tool
  shortcuts don't fire. Typing in text fields, and key chords with Ctrl/Cmd/Alt,
  are ignored.

## HUD

A "キャラクター" settings group (on/off, camera, scheme, speed, turn rate, screen
position, camera lag) plus actions to toggle the character and to place it at the
screen position.

## Service

```ts
import { getCharacterApi } from "@edv4h/usketch-plugin-character";

const api = getCharacterApi(app.services);
api?.enable();
api?.setCameraMode("rotate");
api?.setRenderer(myRenderer);
api?.getPose(); // { x, y, heading, speed, moving }
```

## Limitations

While the camera is rotated, overlays that compute screen positions themselves
(snap guides, resize handles, connectors, comment badges, the background grid)
are not rotation-aware yet. Tools that go through the Core `screenToWorld` get
correct coordinates.
