import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import {
	containerAccepts,
	getContainerAttachHit,
	isContainerAutoAttach,
} from "@edv4h/usketch-shared";
import { createContainmentAttacher } from "@edv4h/usketch-store";
import { setupArrange } from "./arrange.js";
import { setupSnapExclude } from "./snap-exclude.js";

/**
 * Runtime for shapes that declare `container` in their `ShapeDefinition`.
 * Drives the parentId-based container mechanics that can't live in a shape
 * definition alone:
 *
 * - **Auto-attach** — a shape dropped inside a container with
 *   `container.autoAttach` gets `parentId` set (and cleared when moved out).
 *   `container.attachHit: "center"` adopts a shape whose center is inside;
 *   `container.accepts` limits which shapes are adopted.
 * - **Arrange** — a container's `container.layout` positions its children.
 * - **Snap exclusion** — children following a dragged container are excluded
 *   from snapping (requires `plugin-snap`; no-op without it).
 *
 * Selection resolution and move-follow are handled natively by tool-helpers via
 * the same `container` flags, so this plugin only supplies the reactive pieces.
 *
 * Register it after `createSnapPlugin()` so the snap event bus is listening
 * before this plugin emits `snap:configure`.
 */
export function createContainerPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-container",
		name: "コンテナ",
		setup(ctx: PluginContext) {
			const isAttachTarget = (s: ShapeData) => isContainerAutoAttach(ctx.shapes.get(s.type), s);

			const stopAttach = createContainmentAttacher({
				store: ctx.store,
				commands: ctx.commands,
				events: ctx.events,
				isAttachTarget,
				attachHit: (container) => getContainerAttachHit(ctx.shapes.get(container.type), container),
				accepts: (container, shape) =>
					containerAccepts(ctx.shapes.get(container.type), container, shape),
			});
			const stopArrange = setupArrange(ctx);
			const stopSnap = setupSnapExclude(ctx);

			return () => {
				stopAttach();
				stopArrange();
				stopSnap();
			};
		},
	};
}
