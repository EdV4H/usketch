import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { isShapeContainer } from "@edv4h/usketch-shared";

/** Payload accepted by the snap plugin's `snap:configure` event (subset we set). */
interface SnapConfigurePatch {
	excludeTargets?: (shape: ShapeData) => boolean;
}

/**
 * Configure `plugin-snap` to exclude the descendants of a dragged container
 * from snapping. Such descendants follow the container's motion, so snapping
 * them individually (or letting the container snap to them) causes jitter.
 *
 * Walks the full `parentId` chain (cycle-guarded), not just the immediate
 * parent, so deeply-nested descendants (e.g. a shape inside a group inside a
 * dragged frame) are excluded too. Non-selected ancestors and free
 * (child-dragged-alone) cases are untouched, so a child dragged on its own
 * still snaps normally.
 *
 * Returns a teardown that clears the exclusion.
 */
export function setupSnapExclude(ctx: PluginContext): () => void {
	const excludeTargets = (shape: ShapeData): boolean => {
		// Fast paths before allocating the cycle-guard Set — this predicate runs
		// for every candidate shape on every snap frame.
		if (typeof shape.parentId !== "string") return false;
		const selection = ctx.store.getSelection();
		if (selection.size === 0) return false;

		const visited = new Set<string>();
		let current: ShapeData | undefined = shape;
		while (current && typeof current.parentId === "string" && !visited.has(current.parentId)) {
			visited.add(current.parentId);
			const parent = ctx.store.getShape(current.parentId);
			if (!parent) break;
			// Excluded if any selected ancestor is a container being dragged.
			if (selection.has(parent.id) && isShapeContainer(ctx.shapes.get(parent.type), parent)) {
				return true;
			}
			current = parent;
		}
		return false;
	};

	ctx.events.emit<SnapConfigurePatch>("snap:configure", { excludeTargets });

	return () => {
		ctx.events.emit<SnapConfigurePatch>("snap:configure", { excludeTargets: undefined });
	};
}
