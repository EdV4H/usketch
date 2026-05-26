import type {
	CanvasPointerEvent,
	PluginContext,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { containsAABB, createAddShapeCommand, createReparentCommand } from "@edv4h/usketch-store";
import { cleanupIslandGroupTimers, detachIsland, reconcileIslandGroups } from "./auto-group.js";
import { IslandMetaballLayer } from "./island-metaball-layer.js";
import {
	createDefaultIsland,
	getBoundsIsland,
	hitTestIsland,
	renderIsland,
	resizeIsland,
} from "./island-render.js";

function IslandIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<ellipse cx="10" cy="14" rx="8" ry="4" fill="#a8d5ba" stroke="#8bc4a0" strokeWidth="1.5" />
			<circle cx="8" cy="10" r="2" fill="#6b9" />
			<circle cx="12" cy="8" r="3" fill="#5a8" />
			<line x1="12" y1="5" x2="12" y2="8" stroke="#764" strokeWidth="1.5" />
		</svg>
	);
}

export function createIslandPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-island",
		name: "Island",

		setup(ctx: PluginContext) {
			// ── Shape registration ──
			ctx.shapes.register("island", {
				render: renderIsland,
				getBounds: getBoundsIsland,
				hitTest: hitTestIsland,
				resize: resizeIsland,
				createDefault: createDefaultIsland,
				renderTarget: "html",
				minSize: { width: 100, height: 100 },
			});

			// ── Metaball background layer (renders below shapes) ──
			ctx.layers.register({
				id: "island-metaball",
				order: -1,
				fixed: true,
				render: () => <IslandMetaballLayer store={ctx.store} />,
			});

			// ── Drawing tool ──
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;

			function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const id = generateId();
				drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
				const shape = createDefaultIsland({ id, x: event.worldPoint.x, y: event.worldPoint.y });
				shape.width = 0;
				shape.height = 0;
				toolCtx.store.addShape(shape);
			}

			function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;
				const x = Math.min(drawState.startX, event.worldPoint.x);
				const y = Math.min(drawState.startY, event.worldPoint.y);
				const width = Math.abs(event.worldPoint.x - drawState.startX);
				const height = Math.abs(event.worldPoint.y - drawState.startY);
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			}

			function onPointerUp(toolCtx: ToolContext) {
				if (!drawState) return;
				const shape = toolCtx.store.getShape(drawState.shapeId);
				if (shape && shape.width > 10 && shape.height > 10) {
					toolCtx.store.deleteShape(drawState.shapeId);
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
				} else {
					toolCtx.store.deleteShape(drawState.shapeId);
				}
				drawState = null;
				toolCtx.store.setActiveToolId("select");
			}

			ctx.tools.register("island-draw", {
				icon: IslandIcon,
				cursor: "crosshair",
				shortcut: "i",
				order: 6,
				onPointerDown,
				onPointerMove,
				onPointerUp,
				onDeactivate() {
					if (drawState) {
						ctx.store.deleteShape(drawState.shapeId);
						drawState = null;
					}
				},
			});

			// ── Auto-parenting (same pattern as frame plugin) ──

			const CONTAINER_TYPES = new Set(["frame", "island"]);

			function autoReparent(shapeId: string) {
				const shape = ctx.store.getShape(shapeId);
				if (!shape || CONTAINER_TYPES.has(shape.type) || shape.type === "connector") return;

				const shapeBounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

				let bestContainer: ShapeData | null = null;
				for (const [id, candidate] of ctx.store.getShapes()) {
					if (id === shapeId || !CONTAINER_TYPES.has(candidate.type)) continue;
					const containerBounds = {
						x: candidate.x,
						y: candidate.y,
						width: candidate.width,
						height: candidate.height,
					};
					if (containsAABB(containerBounds, shapeBounds)) {
						if (
							!bestContainer ||
							candidate.width * candidate.height < bestContainer.width * bestContainer.height
						) {
							bestContainer = candidate;
						}
					}
				}

				const currentParentId = shape.parentId as string | undefined;
				const newParentId = bestContainer?.id;

				if (currentParentId !== newParentId) {
					ctx.commands.execute(
						createReparentCommand(ctx.store, [shapeId], newParentId ?? undefined),
					);
				}
			}

			// ── Auto-grouping: islands that touch form a group ──

			const unsubMoveEnd = ctx.events.on<{ shapeIds: string[] }>("shapes:move-end", (data) => {
				if (!data?.shapeIds) return;
				setTimeout(() => {
					for (const shapeId of data.shapeIds) {
						const shape = ctx.store.getShape(shapeId);
						if (shape?.type === "island") {
							// Island moved — adopt shapes now inside it
							adoptContainedShapes(shapeId);
						} else {
							// Non-island moved — reparent into nearest container
							autoReparent(shapeId);
						}
					}
					const prevSelection = [...ctx.store.getSelection()];
					reconcileIslandGroups(ctx.store, ctx.commands);
					if (prevSelection.length > 0) {
						ctx.store.setSelection(prevSelection.filter((id) => ctx.store.getShape(id)));
					}
				}, 0);
			});

			// Adopt all non-container shapes fully inside an island
			function adoptContainedShapes(islandId: string) {
				const island = ctx.store.getShape(islandId);
				if (!island || island.type !== "island") return;
				const islandBounds = {
					x: island.x,
					y: island.y,
					width: island.width,
					height: island.height,
				};
				for (const [childId, child] of ctx.store.getShapes()) {
					if (childId === islandId || CONTAINER_TYPES.has(child.type) || child.type === "connector")
						continue;
					if (child.parentId === islandId) continue;
					const childBounds = { x: child.x, y: child.y, width: child.width, height: child.height };
					if (containsAABB(islandBounds, childBounds)) {
						ctx.commands.execute(createReparentCommand(ctx.store, [childId], islandId));
					}
				}
			}

			const unsubAdded = ctx.store.onMutation((event) => {
				if (event.type !== "shape:added") return;
				const payload = event.payload as { id: string } | undefined;
				if (!payload?.id) return;
				const shape = ctx.store.getShape(payload.id);
				if (!shape) return;

				if (shape.type === "island") {
					// Island was just created — adopt shapes already inside it
					adoptContainedShapes(payload.id);
					return;
				}
				if (CONTAINER_TYPES.has(shape.type) || shape.type === "connector") return;
				autoReparent(payload.id);
			});

			// ── Detach: Shift+D to detach selected island from its group ──

			const unsubDetach = ctx.shortcuts.register("Shift+D", () => {
				const selection = ctx.store.getSelection();
				for (const id of selection) {
					const shape = ctx.store.getShape(id);
					if (shape?.type === "island") {
						detachIsland(ctx.store, ctx.commands, id);
					}
				}
			});

			return () => {
				unsubMoveEnd();
				unsubAdded();
				unsubDetach();
				cleanupIslandGroupTimers();
				ctx.layers.unregister("island-metaball");
			};
		},
	};
}
