import {
	type BoundingBox,
	type Command,
	generateId,
	type PluginContext,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import type * as Y from "yjs";
import { type PortalChrome, PortalLayer } from "./portal-layer.js";
import { createPortalStore, defaultPortalBox, type PortalEntry } from "./portal-store.js";

export interface PortalPluginOptions {
	/** Shared Yjs doc — shared portals live in its `portals` map. */
	doc: Y.Doc;
	/** For the per-user localStorage key. */
	boardId?: string;
	/** For the per-user localStorage key. Defaults to "local". */
	userId?: string;
	/** Swap the panel chrome (header/frame). Drag/resize/content are retained as
	 * long as the custom Chrome wires `dragHandleProps`/`resizeHandleProps` and
	 * renders its `children`. */
	components?: { Chrome?: PortalChrome };
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

			const boundsOf = (shapeId: string): BoundingBox | null => {
				const shape = ctx.store.getShape(shapeId);
				if (!shape) return null;
				const def = ctx.shapes.get(shape.type);
				return def
					? def.getBounds(shape)
					: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
			};

			// Restore a held portal's shape back to the canvas (undoable). Held
			// portals own the only copy of the shape, so "closing" one restores it
			// instead of discarding it.
			const restoreToCanvas = (entry: PortalEntry, shared: boolean) => {
				const snapshot = entry.shape;
				if (!snapshot || ctx.store.getShape(snapshot.id)) {
					store.remove(entry.id);
					return;
				}
				ctx.commands.execute({
					execute() {
						ctx.store.addShape(snapshot);
						store.remove(entry.id);
					},
					undo() {
						store.insert(entry, shared);
						ctx.store.deleteShape(snapshot.id);
					},
				});
			};

			ctx.layers.register({
				id: LAYER_ID,
				order: 150,
				fixed: true,
				render: () => (
					<PortalLayer
						portalStore={store}
						store={ctx.store}
						shapes={ctx.shapes}
						Chrome={options.components?.Chrome}
						onRestore={restoreToCanvas}
					/>
				),
			});
			ctx.events.emit("layers:changed", {});

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
				// Stash: remove the selected shapes from the canvas and hold them in
				// the portal (snapshot). Restore puts them back. Mirrors the card hand.
				ctx.actions.register({
					id: "portal:stash-selected",
					label: "📥 選択を取り込む",
					group: "Portal",
					order: 0.5,
					isEnabled: () => ctx.store.getSelection().size >= 1,
					run: () => {
						let i = 0;
						for (const id of [...ctx.store.getSelection()]) {
							const shape = ctx.store.getShape(id);
							const bounds = boundsOf(id);
							if (!shape || !bounds) continue;
							const snapshot: ShapeData = { ...shape };
							const entry: PortalEntry = {
								id: generateId(),
								shapeId: shape.id,
								shape: snapshot,
								...defaultPortalBox(bounds, i),
							};
							const cmd: Command = {
								execute() {
									ctx.store.deleteShape(id);
									store.insert(entry, false);
								},
								undo() {
									store.remove(entry.id);
									ctx.store.addShape(snapshot);
								},
							};
							ctx.commands.execute(cmd);
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
					run: () => {
						// Held portals hold the only copy → restore to canvas instead of
						// discarding. Pin portals just detach.
						for (const it of store.getAll().filter((x) => !x.shared)) {
							if (it.entry.shape) restoreToCanvas(it.entry, false);
							else store.remove(it.entry.id);
						}
					},
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
