---
"@edv4h/usketch-plugin-whistle": minor
---

Whistles now come in four kinds, and each kind moves the people who hear it differently:

- `call` (おーい): no movement. A pulse at the whistler's spot, and an edge badge when it is off-screen (click to go there). Messages without a kind are treated as `call`, so older clients keep working.
- `gather` (集合): a prompt with "あとで" / "移動する"; accepting moves smoothly to the whistler's view.
- `assemble` (全員集合): a 3 s countdown, then everyone swoops (zoom out, then in) to the whistler's view. "残る" cancels it.
- `follow` (ついてきて): everyone follows the whistler's camera until the whistler ends it; doing anything on the canvas yourself leaves.

New options on `createWhistlePlugin(wsProvider, options)`: `canAutoMove` (return false while presenting etc. to turn forced moves into prompts; by default a client whose awareness state has `presenting: true` gets prompts), `labels` (i18n), `renderers` (replace the pulse, edge badge, prompt, countdown, follow banner/frame and sent feedback), `getLocalName`, `shortcut` and `timings`. Hosts can blow without the HUD through the `whistleService` / `getWhistleApi(app.services)` API (`blow(kind)`, `setSelectedKind`, `endFollow`, `getCooldownRemaining`, `subscribe`). The HUD gets one action per kind. Pulses and edge badges stay on the `whistle-indicator` layer; prompts, the countdown and the follow banner/frame move to a new screen-anchored `whistle-ui` layer. A follower leaves when the view changes for any reason other than the whistle itself, and stops following when the leader goes silent (the leader sends a heartbeat every 2 s). The overlay measures the canvas instead of assuming a full-window canvas, and `prefers-reduced-motion` turns the moves and pulses static.
