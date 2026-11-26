# @edv4h/usketch-plugin-tabletop

## 0.6.0

### Minor Changes

- e4f71ec: Add game tables (`tabletop-table`) and seats (`tabletop-seat`). A table is rectangular, round or a regular polygon (3–8 sides); what is put on it becomes its child and moves with it. Seats are shapes of their own with a label; put on a table they snap onto its outline, facing it, and `seatViewRect` gives the camera rect that shows the whole table from that seat. New actions add a table (with two players), add a player, spread players evenly, and set the table's form, camera and a player's name.

### Patch Changes

- 5bff4d1: Seats already on a table's outline stay put when the table lays out again (a seat at a corner no longer jumps to the next edge, and seats on a round table no longer creep). Spreading players starts at the exact middle of the bottom. `createTableWithSeats`, `roomiestSeatPlacement` and `isSeated` are exported; a new player goes where there is the most room.

## 0.5.2

### Patch Changes

- Updated dependencies [546c8b8]
  - @edv4h/usketch-shared@4.34.0
  - @edv4h/usketch-store@3.16.0
  - @edv4h/usketch-shape-utils@2.4.15

## 0.5.1

### Patch Changes

- 1b665c3: Let a container be clicked when it is laid on a picture.
  
  - `container.winsOverBackdrop` (default `false`): a container with selectable children (a frame) is picked only where no other shape is hit, so a card slot laid on a board picture could never be clicked. With `true`, a click on the container picks it over its backdrop: a shape drawn behind it whose bounds wholly enclose it. Other shapes (a card lying partly under it, a shape drawn on top) still win as before. `containerWinsOverBackdrop(def, shape)` reads it.
  - Tabletop zones set `winsOverBackdrop: true`, so a zone laid on a board picture can be clicked and selected.
- Updated dependencies [1b665c3]
  - @edv4h/usketch-shared@4.33.0
  - @edv4h/usketch-store@3.15.1
  - @edv4h/usketch-shape-utils@2.4.14

## 0.5.0

### Minor Changes

- 3701095: 傾けた 3D の画面でも、プレイヤー視点の枠に合わせられるようにしました。
  
  - tabletop: `applyViewCamera` に `getTilt`（`{ pitch, fov, horizon }`、毎回読む。`null` = 平ら）を足しました。ホストが盤面を奥へ傾けて見せている間（Mode 7 など）、視点を傾いた見え方で枠に収めます（画面の中央に、手前の広い辺も含めて 4 つの角が余白の内側に入るいちばん大きいズームで）。`fixed` はその位置で止め、`zoom` は拡大した分だけ動けます。`fitViewToScreen` / `isAtView` も `tilt` を、`stayInViewConstraint` / `pinToViewConstraint` も `getTilt` を受け取ります。型 `ViewTilt`（上げたカメラの `heightPx` も渡せます）を出しました。傾きを変えたら `returnToView()` で合わせ直してください。
  - mode7: `exitOnShapeDoubleClick`（既定 `true`）を足しました。`false` にすると、Shape をダブルクリックしても平面へ戻らず 3D のままです。

### Patch Changes

- 56a137e: 読み取り専用のページ（見るだけの人）を足した。
  
  - `BoardStore` に `isReadOnly` / `setReadOnly` / `applyExternal`（任意）。読み取り専用のあいだ、閲覧者自身の Shape の追加・変更・削除は止まり、同期で届く他の人の変更と保存したものの読み込みだけが `applyExternal(store, fn)` で通る。読むときは `isReadOnly(store)`。
  - `createApp` は `page.edit` が無いと読み取り専用で開き、権限が変わったら追う（`readOnly: true` で権限に関係なく読み取り専用にもできる。そのとき `app.permissions` も `page.edit` を不可と答える）。
  - `ToolDefinition.readOnlySafe`: 読み取り専用のページでも使えるツール（select・pan・laser・spotlight・reactions・effect-ripple・spatial-chat）。それ以外のツールには切り替わらず、HUD のツール欄にも出ない（`isToolUsable(store, tool)`）。
  - 選択ツールは読み取り専用では選ぶだけ（移動・リサイズ・回転・他のプラグインのハンドルを出さない）。
  - 同期（sync-localstorage-yjs / sync-ywebsocket）は doc からストアへ入れるときに `applyExternal` を使う。
  - ページを変える HUD の操作に `requires: "page.edit"` を付けた（図形・カード・卓・タイマー・グループ・標高など）。見るだけの人には出ない。
- Updated dependencies [61ee9e6]
- Updated dependencies [56a137e]
  - @edv4h/usketch-shared@4.32.0
  - @edv4h/usketch-store@3.15.0
  - @edv4h/usketch-shape-utils@2.4.13

## 0.4.0

### Minor Changes

- ba2c89c: Turned zones and player views. A zone turned on the board (a hand across the table) now lays out along its own edges, and its children turn with it so they read the right way up for the player sitting there (every arrangement but `free`; an unturned zone still leaves a child's own turn alone). A turned player view turns the camera the other way, so the seat across the table sees its view upright: `fitViewToScreen`, the `fixed` / `zoom` holds and `isAtView` take the view's turn, the hold keeps it (the camera still can't be turned by hand), and the move to the view swings about the screen's centre. **Add player view** on a turned camera makes a view turned the same way. New in tabletop: `ViewRect` (a box plus `rotation`), `viewRectOf(shape)`, `viewCameraRotation(rect)`, `screenViewRect(viewport, size)` and `rotation` on `createViewShape`. New in store / shared: `animateViewportTo(target, { pivot })` keeps the world point under a screen point moving straight, so a move that also turns the camera doesn't sweep the board off screen.

### Patch Changes

- Updated dependencies [5dc7d1b]
- Updated dependencies [8d13a3a]
- Updated dependencies [9aa4ddb]
- Updated dependencies [ba2c89c]
  - @edv4h/usketch-shared@4.31.0
  - @edv4h/usketch-store@3.14.0
  - @edv4h/usketch-shape-utils@2.4.12

## 0.3.0

### Minor Changes

- 8cb08f0: Player views: a new `tabletop-view` shape marks what a player sees while a game is played (`label`, `camera`: `fixed` / `zoom` / `free`, default `zoom`). Only its edge and label strip take clicks. `applyViewCamera(store, getRect, camera, { getSize })` brings the camera to a view and holds it with the store's viewport constraint (returns `release` / `returnToView`); the pieces (`fitViewToScreen`, `stayInViewConstraint`, `pinToViewConstraint`, `isAtView`, `visibleWorldRect`) are exported. Views come with `createViewShape`, `readViewMeta`, `listViews`, `setViewLabel` / `setViewCamera`, service methods (`addView`, `setViewLabel`, `setViewCamera`, `views`), HUD actions (**Add player view**, **View camera**, **View label**) and the `views` / `renderView` plugin options.

## 0.2.0

### Minor Changes

- cff264e: Zones can lean their layout to the left, the middle or the right: new `align` meta (`start` / `center` / `end`), `setAlign` on the service, `setZoneAlign`, and a **Zone alignment** HUD action. `pile` and `spread` move as a block; `grid` aligns each row on its own. A zone without its own `align` keeps today's layout (`grid` from the left, the others centered) and follows its `arrange` when that changes (`storedZoneMeta` is what `updateZoneMeta` writes back). `arrangeBy` takes the alignment as an optional fifth argument.

### Patch Changes

- Updated dependencies [3566290]
  - @edv4h/usketch-shared@4.30.0
  - @edv4h/usketch-store@3.13.2
  - @edv4h/usketch-shape-utils@2.4.11

## 0.1.1

### Patch Changes

- Updated dependencies [66e8499]
  - @edv4h/usketch-shared@4.29.0
  - @edv4h/usketch-store@3.13.1
  - @edv4h/usketch-shape-utils@2.4.10

## 0.1.0

### Minor Changes

- f5366ad: New plugin `@edv4h/usketch-plugin-tabletop` with zones (`tabletop-zone`): places on the board that hold cards or pieces and lay out what is dropped in them (pile, spread, grid or free), optionally turning it up or down. `@edv4h/usketch-plugin-shape-card` adds `cardTurnFace`, which turns a card or deck up or down for a zone.

### Patch Changes

- Updated dependencies [3d0a677]
  - @edv4h/usketch-shared@4.28.0
  - @edv4h/usketch-store@3.13.0
  - @edv4h/usketch-shape-utils@2.4.9
