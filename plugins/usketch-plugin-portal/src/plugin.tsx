import type { BoundingBox, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type * as Y from "yjs";
import { PortalLayer } from "./portal-layer.js";
import { createPortalStore, defaultPortalBox } from "./portal-store.js";

export interface PortalPluginOptions {
	/** Shared Yjs doc — shared portals live in its `portals` map. */
	doc: Y.Doc;
	/** For the per-user localStorage key. */
	boardId?: string;
	/** For the per-user localStorage key. Defaults to "local". */
	userId?: string;
}

const LAYER_ID = "portal";

/**
 * "Portal" — pin any shape to a fixed on-screen panel that stays visible through
 * pan/zoom (picture-in-picture). Portals are per-user by default (localStorage)
 * and can be toggled to shared (a `portals` Y.Map, synced to everyone). The panel
 * re-renders the shape via its registered definition, so interactive shapes (e.g.
 * the timer) remain operable inside the portal.
 */
export function createPortalPlugin(options: PortalPluginOptions): UsketchPlugin {
	return {
		id: "usketch-plugin-portal",
		name: "ポータル",

		setup(ctx: PluginContext) {
			const store = createPortalStore({
				doc: options.doc,
				userId: options.userId ?? "local",
				boardId: options.boardId,
			});

			ctx.layers.register({
				id: LAYER_ID,
				order: 150,
				fixed: true,
				render: () => <PortalLayer portalStore={store} store={ctx.store} shapes={ctx.shapes} />,
			});
			ctx.events.emit("layers:changed", {});

			const boundsOf = (shapeId: string): BoundingBox | null => {
				const shape = ctx.store.getShape(shapeId);
				if (!shape) return null;
				const def = ctx.shapes.get(shape.type);
				return def
					? def.getBounds(shape)
					: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
			};

			const offActions = [
				ctx.actions.register({
					id: "portal:pin-selected",
					label: "📌 選択をポータル",
					group: "Portal",
					order: 0,
					isEnabled: () => ctx.store.getSelection().size >= 1,
					run: () => {
						const already = new Set(store.getAll().map((it) => it.entry.shapeId));
						let i = 0;
						for (const id of ctx.store.getSelection()) {
							if (already.has(id)) continue;
							const bounds = boundsOf(id);
							if (!bounds) continue;
							store.add(id, defaultPortalBox(bounds, i));
							i++;
						}
					},
				}),
				ctx.actions.register({
					id: "portal:clear-mine",
					label: "✕ 自分のポータルを全解除",
					group: "Portal",
					order: 1,
					isEnabled: () => store.getAll().some((it) => !it.shared),
					run: () => store.clearPrivate(),
				}),
			];

			return () => {
				for (const off of offActions) off();
				ctx.layers.unregister(LAYER_ID);
				ctx.events.emit("layers:changed", {});
				store.destroy();
			};
		},
	};
}
