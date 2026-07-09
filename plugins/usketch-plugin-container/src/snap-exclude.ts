import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { isShapeContainer } from "@edv4h/usketch-shared";

/** Payload accepted by the snap plugin's `snap:configure` event (subset we set). */
interface SnapConfigurePatch {
	excludeTargets?: (shape: ShapeData) => boolean;
}

/**
 * Configure `plugin-snap` to exclude a container's children from snapping while
 * the container is being dragged. Such children follow the parent's motion, so
 * snapping them individually (or letting the parent snap to them) causes
 * jitter. Non-selected children and free (child-dragged-alone) cases are
 * untouched, so a child dragged on its own still snaps normally.
 *
 * Returns a teardown that clears the exclusion.
 */
export function setupSnapExclude(ctx: PluginContext): () => void {
	const excludeTargets = (shape: ShapeData): boolean => {
		const parentId = shape.parentId;
		if (typeof parentId !== "string" || !ctx.store.getSelection().has(parentId)) return false;
		const parent = ctx.store.getShape(parentId);
		return !!parent && isShapeContainer(ctx.shapes.get(parent.type), parent);
	};

	ctx.events.emit<SnapConfigurePatch>("snap:configure", { excludeTargets });

	return () => {
		ctx.events.emit<SnapConfigurePatch>("snap:configure", { excludeTargets: undefined });
	};
}
