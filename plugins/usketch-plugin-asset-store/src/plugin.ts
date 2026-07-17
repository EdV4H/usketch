import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type * as Y from "yjs";
import { type AssetStore, createAssetStore } from "./asset-store.js";

/** Service key under which the asset store is provided on `ctx.services`. */
export const ASSET_STORE_SERVICE = "asset-store";

/** Typed accessor for the shared asset store (or undefined if not provided). */
export function getAssetStore(ctx: PluginContext): AssetStore | undefined {
	return ctx.services.get<AssetStore>(ASSET_STORE_SERVICE);
}

export interface AssetStorePluginOptions {
	/** Shared Yjs doc — assets live in its `assets` map. */
	doc: Y.Doc;
	mapName?: string;
}

/**
 * Provides a content-addressed {@link AssetStore} (backed by a Yjs Map) on
 * `ctx.services`. Any plugin retrieves it via {@link getAssetStore} to store /
 * resolve heavy blobs (images, …) once and reference them by id — see the image
 * shape plugin. Consumers may `setUploader`/`setResolver` to route uploads to a
 * real backend. No server change: the Durable Object relays/persists the map.
 */
export function createAssetStorePlugin(options: AssetStorePluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-asset-store",
		name: "アセットストア",

		setup(ctx: PluginContext) {
			const store = createAssetStore(options.doc, { mapName: options.mapName });
			const off = ctx.services.provide(ASSET_STORE_SERVICE, store);
			return () => {
				off();
				store.destroy();
			};
		},
	};
}
