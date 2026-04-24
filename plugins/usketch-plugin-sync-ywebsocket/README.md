# @edv4h/usketch-plugin-sync-ywebsocket

Bridge a uSketch app to any [y-websocket](https://github.com/yjs/y-websocket) server. Wraps `WebsocketProvider` and exposes a `WsProviderHandle`-compatible adapter so it plugs directly into plugins like `@edv4h/usketch-plugin-presence-cursor`.

Designed for teams that already run a y-websocket backend (or need to migrate off another realtime engine) and want to keep their sync layer while adopting uSketch on the client.

## Install

```sh
pnpm add @edv4h/usketch-plugin-sync-ywebsocket
```

## Basic usage

```ts
import { createApp } from "@edv4h/usketch-core";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createYwebsocketSyncPlugin } from "@edv4h/usketch-plugin-sync-ywebsocket";

const syncPlugin = createYwebsocketSyncPlugin({
  url: "wss://yws.example.com",
  roomName: "board-123",
});

const app = await createApp({
  plugins: [
    syncPlugin,
    // Pass the provider into presence-cursor (after setup, the handle is ready).
    createPresenceCursorPlugin({
      wsProvider: syncPlugin.getWsProvider(),
      userId: "alice",
      userName: "Alice",
    }),
  ],
});
```

Because `getWsProvider()` must be called after the sync plugin's `setup()` has run, a simple pattern is to split plugin registration into two awaited phases — or to rely on `createApp` awaiting plugins in order, and to pass the provider via a late-binding thunk where your framework permits.

## Options

```ts
createYwebsocketSyncPlugin({
  url,                    // ws(s):// base URL of the y-websocket server
  roomName,               // server-side document identifier
  shapesMapKey,           // optional — defaults to "shapes" (weboard uses "map")
  resolveParams,          // async/sync callback to supply URL query params on each connect
  onCloseCode,            // classify close codes: "retry" | "stop" | undefined (default backoff)
  idleTimeoutMs,          // 0 (off) — disconnect after this many ms of inactivity
  autoConnect,            // default true — connect on plugin setup
  doc,                    // optional — bring your own Y.Doc (useful for mid-life migrations)
  WebSocketPolyfill,      // optional — Node test environments only
});
```

### Resolving auth tokens on each connect

`resolveParams` is called before every connect and reconnect. Use it to hand back freshly refreshed tokens so the server sees a valid credential on reconnect:

```ts
createYwebsocketSyncPlugin({
  url: "wss://yws.example.com",
  roomName: "board-123",
  async resolveParams({ attempt, previousCloseCode }) {
    // Force a fresh token if the previous connection was rejected for auth.
    const forceRefresh = previousCloseCode === 4003 || previousCloseCode === 4004;
    const token = await cognitoSession.getAccessToken({ forceRefresh });
    return {
      params: {
        token: token.jwt,
        employeeId: String(token.employeeId),
        companyId: String(token.companyId),
      },
    };
  },
  onCloseCode(code) {
    if (code === 4003 || code === 4004) return "retry"; // immediate retry; resolveParams will fetch a fresh token
    return undefined; // fall through to exponential backoff
  },
});
```

### Idle disconnect

Set `idleTimeoutMs` to disconnect after inactivity (no local Y.Doc mutations). Call `handle.resume()` to reconnect on the next user interaction.

```ts
const plugin = createYwebsocketSyncPlugin({
  url: "wss://yws.example.com",
  roomName: "board-123",
  idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
});

// Later, in an interaction handler:
plugin.getHandle().resume();
```

## Advanced: accessing the handle

```ts
const handle = syncPlugin.getHandle();
handle.disconnect();       // manual disconnect; stays disconnected
handle.resume();           // reconnect after a disconnect/idle
handle.status.subscribe(() => console.log(handle.status.getSnapshot()));
handle.doc;                // the underlying Y.Doc
handle.whenSynced;         // promise that resolves on first server sync
handle.wsProvider;         // WsProviderHandle adapter (same as getWsProvider())
```

## WsProviderHandle compatibility

`handle.wsProvider` implements the `WsProviderHandle` contract from `@edv4h/usketch-sync` so plugins that consume `WsProviderHandle` work out of the box:

| member              | supported                                 |
| ------------------- | ----------------------------------------- |
| `connected`         | yes                                        |
| `awareness`         | yes (after the first `connect()`)          |
| `onStatusChange`    | yes                                        |
| `onBroadcast`       | listeners accepted; never emits (no-op)    |
| `broadcast`         | no-op — y-websocket has no side-channel    |
| `requestPartition`  | no-op — y-websocket has no partitions      |
| `onPartitionMeta`   | no-op — y-websocket has no partitions      |
| `destroy`           | yes                                        |

If you need broadcast / partition semantics, stay on `@edv4h/usketch-sync`'s `createWsProvider()` with a uSketch-native server.

## License

MIT
