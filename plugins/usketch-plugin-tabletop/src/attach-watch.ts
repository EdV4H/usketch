import { type PluginContext, type ShapeData, zIndexAfterAll } from "@edv4h/usketch-shared";
import { isZone, readZoneMeta, type ZoneFace } from "./zone.js";

/** Event emitted on `ctx.events` when the local user drops a shape into a zone. */
export const ZONE_ATTACHED_EVENT = "tabletop:zone-attached";
/** Event emitted on `ctx.events` when the local user takes a shape out of a zone. */
export const ZONE_DETACHED_EVENT = "tabletop:zone-detached";

export interface ZoneAttachEvent {
	zoneId: string;
	shapeId: string;
}

/**
 * Turn `shape` up or down. Return the patch to apply, or `null` when the shape
 * has no faces (or already shows that face). Hosts pass one that knows their
 * shapes, e.g. `cardTurnFace` from `@edv4h/usketch-plugin-shape-card`.
 */
export type TurnFace = (
	shape: ShapeData,
	face: Exclude<ZoneFace, "keep">,
) => Partial<ShapeData> | null;

export interface AttachWatchOptions {
	turnFace?: TurnFace;
	onAttach?: (event: ZoneAttachEvent) => void;
	onDetach?: (event: ZoneAttachEvent) => void;
}

/**
 * Watch the local user's drops: after a move ends and the container plugin has
 * (re)attached the moved shapes, a shape that went into a zone is raised to the
 * top of it and turned to the zone's face; one that left a zone is reported.
 *
 * Runs only for the user who moved (`shapes:move-end` is local), so the face
 * and order are written once, not by every collaborator. Not part of undo, like
 * flipping a card. Register the tabletop plugin after the container plugin so
 * this runs after its deferred reparent.
 */
export function setupAttachWatch(ctx: PluginContext, opts: AttachWatchOptions): () => void {
	const pending = new Set<ReturnType<typeof setTimeout>>();

	const off = ctx.events.on<{ shapeIds: string[] }>("shapes:move-end", (data) => {
		if (!data?.shapeIds?.length) return;
		const before = new Map<string, string | undefined>();
		for (const id of data.shapeIds) {
			const parentId = ctx.store.getShape(id)?.parentId;
			before.set(id, typeof parentId === "string" ? parentId : undefined);
		}
		const timer = setTimeout(() => {
			pending.delete(timer);
			for (const [id, was] of before) settle(id, was);
		}, 0);
		pending.add(timer);
	});

	function settle(id: string, was: string | undefined) {
		const shape = ctx.store.getShape(id);
		if (!shape) return;
		const now = typeof shape.parentId === "string" ? shape.parentId : undefined;
		if (now === was) return;
		if (was && isZone(ctx.store.getShape(was))) {
			ctx.events.emit(ZONE_DETACHED_EVENT, { zoneId: was, shapeId: id });
			opts.onDetach?.({ zoneId: was, shapeId: id });
		}
		const zone = now ? ctx.store.getShape(now) : undefined;
		if (!now || !zone || !isZone(zone)) return;

		const { arrange, face } = readZoneMeta(zone);
		const patch: Partial<ShapeData> = {};
		// The newest drop goes on top of a pile / at the end of a row.
		if (arrange !== "free") {
			patch.zIndex = zIndexAfterAll(ctx.store.getShapesSorted().map((s) => s.zIndex));
		}
		if (face !== "keep" && opts.turnFace) Object.assign(patch, opts.turnFace(shape, face) ?? {});
		if (Object.keys(patch).length > 0) ctx.store.updateShape(id, patch);

		ctx.events.emit(ZONE_ATTACHED_EVENT, { zoneId: now, shapeId: id });
		opts.onAttach?.({ zoneId: now, shapeId: id });
	}

	return () => {
		off();
		for (const t of pending) clearTimeout(t);
		pending.clear();
	};
}
