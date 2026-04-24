import type { WsConnectionStatus, WsProviderHandle } from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import type { SyncStatusTracker } from "./sync-status-tracker.js";

export interface ConnectionParams {
	/** URL query params to attach on each connection attempt. */
	params?: Record<string, string>;
}

export interface ResolveParamsContext {
	/**
	 * Backoff attempt counter — 0 on the first connect, increments with each
	 * failed reconnect cycle, and resets to 0 whenever an `onCloseCode` handler
	 * returns `"retry"` (explicit retries skip the backoff ramp).
	 */
	attempt: number;
	/** Optional close code from the previous disconnect (if any). */
	previousCloseCode?: number;
	/** Optional close reason from the previous disconnect (if any). */
	previousCloseReason?: string;
}

export interface YwebsocketSyncOptions {
	/** Base URL of the y-websocket server (e.g. "wss://yws.example.com"). */
	url: string;
	/** Room name — the document identifier on the server. */
	roomName: string;

	/**
	 * The Yjs map key that stores shapes. Defaults to `"shapes"`.
	 * Use this when connecting to a server that expects a different key (e.g. weboard uses `"map"`).
	 */
	shapesMapKey?: string;

	/**
	 * Resolve URL query params on each connection attempt.
	 * Called before every connect/reconnect — return freshly refreshed query params
	 * or tokens here. If omitted, no query params are attached.
	 */
	resolveParams?: (ctx: ResolveParamsContext) => Promise<ConnectionParams> | ConnectionParams;

	/**
	 * Custom close-code handler. Called whenever the underlying socket closes.
	 * Return `"retry"` to trigger an immediate reconnect (bypassing backoff),
	 * `"stop"` to give up and leave the provider disconnected,
	 * or `undefined` to fall through to the default backoff retry.
	 */
	onCloseCode?: (code: number, reason: string) => "retry" | "stop" | undefined;

	/**
	 * Disconnect automatically after this many milliseconds of inactivity.
	 * The timer resets on local store mutations, when the socket reports `connected`,
	 * and when `resume()` is called. Set to `0` (or omit) to disable.
	 */
	idleTimeoutMs?: number;

	/**
	 * Explicitly opt in/out of the initial `connect` call.
	 * Defaults to `true` — the provider connects on creation.
	 */
	autoConnect?: boolean;

	/**
	 * Provide an existing Y.Doc to sync. If omitted, a new Y.Doc is created.
	 * Weboard's migration path can pass in a pre-existing Y.Doc that already holds legacy state.
	 */
	doc?: Y.Doc;

	/**
	 * WebSocket constructor polyfill (for Node test environments).
	 * In the browser, this is picked up from `globalThis.WebSocket` automatically.
	 */
	WebSocketPolyfill?: typeof WebSocket;
}

export interface YwebsocketSyncHandle {
	/** The Y.Doc being synced. */
	doc: Y.Doc;
	/** Observable sync status (loading/synced/disconnected/error). */
	status: SyncStatusTracker;
	/**
	 * Resolves when the first server sync completes, when `resolveParams` fails the
	 * initial attempt, when `onCloseCode` returns `"stop"`, or on `destroy()`.
	 * Resolves, never rejects — inspect `status.getSnapshot()` for the latest state
	 * (in particular `state === "error"` / `"disconnected"`) to detect failure modes.
	 */
	whenSynced: Promise<void>;

	/**
	 * WsProviderHandle-compatible adapter. Plug this into `@edv4h/usketch-plugin-presence-cursor`
	 * (and similar plugins) that accept a `WsProviderHandle`.
	 * Broadcast / partition APIs are no-ops (y-websocket has no equivalent).
	 */
	wsProvider: WsProviderHandle;

	/** Manually disconnect. The provider stays disconnected until `resume()` is called. */
	disconnect(): void;
	/** Reconnect after a manual `disconnect()` or an idle timeout. */
	resume(): void;

	/** Tear down all resources — removes listeners, destroys provider and awareness. */
	destroy(): void;
}

export type { WsConnectionStatus };
