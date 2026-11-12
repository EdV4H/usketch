# @edv4h/usketch-plugin-croupier

Play [croupier](https://github.com/EdV4H/croupier) games (`@edv4h/croupier-core`)
on the board. A **table** shape holds the game and its engine snapshot; every
player who joins gets a **seat** shape on the table. The plugin knows no rules:
the host app passes the games (e.g. Values Card) and the plugin runs them
through the normal shape sync — no game server needed.

**Turn-based games only.** Every move rewrites the table shape, and a shape is
synced as one value (last writer wins). Two players acting at the same moment
would overwrite each other, so games where several players act at once (e.g.
Planning Poker voting) are not supported.

## Install

```ts
import { createValuesCardConfig } from "@edv4h/croupier-plugin-values-card";
import { createCroupierPlugin, defineCroupierGame } from "@edv4h/usketch-plugin-croupier";

createCroupierPlugin({
  player: { userId, name, avatarUrl },
  games: [
    defineCroupierGame({
      id: "values-card",
      label: "Values Card",
      createConfig: (options) => createValuesCardConfig({ theme: String(options.theme ?? "") }),
      defaultOptions: { theme: "大事にしたいこと" },
      maxPlayers: 8,
      // Buttons of the built-in look: one per card for actions that take a card.
      actionChoices: (action, view, viewer) =>
        action === "discardCard"
          ? view.players[viewer].hand.map((c) => ({ label: c.name, payload: { cardId: c.id } }))
          : [{ label: action }],
    }),
  ],
  presence: createAwarenessPresence(wsProvider.awareness, () => userId), // optional, see "Absent players"
  gameState: createMapGameState(doc.getMap("croupier")), // recommended, see "How it syncs"
  now: serverClock.now,  // optional: shared clock for turn timing
  renderTable,           // optional: your own look (see below)
  renderSeat,
});
```

## How it syncs

A board shape is synced as one value (last writer wins), so each write has one owner:

| Shape | `meta` | Written by |
| --- | --- | --- |
| `croupier-table` | game id, options, host, phase (`lobby` / `playing` / `finished`) | the host (lobby, start, reset), and whoever ends the game |
| `gameState` entry (keyed by table id) | engine snapshot (`CroupierCore#toSnapshot`), turn start time | the player whose turn it is |
| `croupier-seat` (child of the table) | user id, name, join time, result note | the seated player |

- **Joining** adds a seat shape instead of editing a shared list, so players joining at the same moment never drop each other. Seat order = turn order.
- **Playing**: an action restores the engine from the stored snapshot (`CroupierCore.fromSnapshot`), dispatches it and writes the new snapshot back. The snapshot log is capped (`SNAPSHOT_LOG_LIMIT`).
- **Where the snapshot lives**: pass `gameState: createMapGameState(doc.getMap("croupier"))` (any `Y.Map`-like map synced with the board). Without it the snapshot (a few KB) sits in the table's `meta`; the board rewrites a shape as a whole on every change, so every move — and every frame of dragging the table — adds the whole snapshot to the board's history.
- **Hidden information** is hidden by the game's `playerView` only: renderers get `getPlayerView(localPlayer)`, but the snapshot itself is readable by every client. Fine for social games; a game that must be cheat-proof needs a server (see `@croupier/server`).
- **Absent players**: with a `presence` adapter (`{ isOnline(userId), subscribe(listener) }`; `createAwarenessPresence` builds one from a Yjs awareness), the host's client plays the turn of a player who has been offline for `awayGraceMs` (default 20 s) with the game's bot — only that player's turn, never one of a connected player. Once a turn exceeds the game's own `turnTimeoutMs`, the bot plays it for whoever is due. An offline host is replaced by the first connected player. `awayGraceMs: false` turns this off.
- **Copy / delete**: a pasted copy of a table becomes a fresh lobby (same host), its copied seats are dropped, and seats of a table that was deleted are removed (`repairTables`, run on every change). A seat whose table has not loaded yet is kept.

Undo: the plugin writes game moves with plain `store.updateShape`. If your app's undo history records every store write (e.g. a Yjs `UndoManager` over the shapes map), keep the types in `CROUPIER_SHAPE_TYPES` out of it so Ctrl+Z cannot roll a move back.

## API

Operations are plain functions over the store (`joinTable`, `startGame`, `dispatchAction`, `takeOverTurn`, …, all exported) and are bundled as a service bound to the local player:

```ts
import { croupierService } from "@edv4h/usketch-plugin-croupier";

const croupier = croupierService.get(app.services)!;
const tableId = croupier.createTable("values-card", { x: 0, y: 0 }, { theme: "仕事で大事なこと" });
croupier.join(tableId);
croupier.start(tableId);                                  // host only
croupier.dispatch(tableId, "drawFromDeck");               // current player only
croupier.dispatch(tableId, "discardCard", { cardId });
const view = croupier.getView(tableId);                   // TableView of the local player
```

`TableView` carries the phase, seats, the masked `gameView`, `currentPlayers`, `isMyTurn`, the `allowedActions` of the current stage, the final `result` (only once finished) and the masked log.

The Debug HUD gets a "Croupier" group (place a table per game; join / leave / start / reset the selected table), and the `croupier-table-draw` tool places a table of `api.getPendingGame()` on click.

## Custom look

`renderTable({ shape, view, api })` and `renderSeat({ seat, view, api, isCurrent, isOnline })` replace the built-in visuals (a plain panel with lobby buttons and the raw view). Seats are laid out by the table's container `layout`, so the host app needs the container plugin (otherwise seats keep where they were placed and may overlap). The table is a container shape, so its wrapper has `pointer-events: none`: give in-shape controls `pointerEvents: "auto"` and spread `stopCanvas` on them so a click does not start a drag.
