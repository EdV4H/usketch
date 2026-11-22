import { type BoardStore, DEFAULT_STYLE, generateId, type ShapeData } from "@edv4h/usketch-shared";

/**
 * The `tabletop-view` shape type: a player's view of the table — the area their
 * camera is brought to while a game is played (see `applyViewCamera`). A board can
 * have any number of them (one per seat, or one for everyone).
 */
export const VIEW_TYPE = "tabletop-view";

/**
 * How the camera is held on a view while it is applied.
 * - `fixed` — it can't be moved at all
 * - `zoom`  — zooming in and panning inside the view are allowed; it can't zoom out
 *             past the view or show what is outside it
 * - `free`  — it is brought to the view once and can then go anywhere
 */
export type ViewCamera = "fixed" | "zoom" | "free";
export const VIEW_CAMERAS: readonly ViewCamera[] = ["fixed", "zoom", "free"];

/** `tabletop-view` shape meta. */
export interface TabletopViewMeta {
	/** Shown on the view (e.g. "Seat 1", "North"). */
	label: string;
	camera: ViewCamera;
}

export const DEFAULT_VIEW_SIZE = { width: 960, height: 540 } as const;

const isCamera = (v: unknown): v is ViewCamera =>
	typeof v === "string" && (VIEW_CAMERAS as readonly string[]).includes(v);

/** Read a view's meta, filling defaults for missing or unknown values (camera: `zoom`). */
export function readViewMeta(shape: Pick<ShapeData, "meta">): TabletopViewMeta {
	const m = (shape.meta ?? {}) as Partial<Record<keyof TabletopViewMeta, unknown>>;
	return {
		label: typeof m.label === "string" ? m.label : "",
		camera: isCamera(m.camera) ? m.camera : "zoom",
	};
}

export function isView(shape: Pick<ShapeData, "type"> | undefined): boolean {
	return shape?.type === VIEW_TYPE;
}

export interface CreateViewShapeParams extends Partial<TabletopViewMeta> {
	id?: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	zIndex?: string;
}

/** Shape data for a new view (pass it to `store.addShape` or an add command). */
export function createViewShape(params: CreateViewShapeParams): ShapeData {
	const meta = readViewMeta({ meta: { label: params.label, camera: params.camera } });
	return {
		id: params.id ?? generateId(),
		type: VIEW_TYPE,
		x: params.x,
		y: params.y,
		width: params.width ?? DEFAULT_VIEW_SIZE.width,
		height: params.height ?? DEFAULT_VIEW_SIZE.height,
		...(params.zIndex ? { zIndex: params.zIndex } : {}),
		style: { ...DEFAULT_STYLE },
		meta: meta as unknown as ShapeData["meta"],
	};
}

/** The board's views, back to front (hidden ones too: a host may hide them while playing). */
export function listViews(store: BoardStore): ShapeData[] {
	return store.getShapesSorted().filter((shape) => isView(shape));
}

/** Patch a view's meta. Returns false when `viewId` is not a view. */
export function updateViewMeta(
	store: BoardStore,
	viewId: string,
	patch: Partial<TabletopViewMeta>,
): boolean {
	const view = store.getShape(viewId);
	if (!view || !isView(view)) return false;
	const next = { ...(view.meta ?? {}), ...readViewMeta(view), ...patch };
	store.updateShape(viewId, { meta: next as ShapeData["meta"] });
	return true;
}

export const setViewLabel = (store: BoardStore, viewId: string, label: string) =>
	updateViewMeta(store, viewId, { label });
export const setViewCamera = (store: BoardStore, viewId: string, camera: ViewCamera) =>
	updateViewMeta(store, viewId, { camera });

/**
 * Whether a world point hits a view. Only the frame's edge (`band` world units
 * wide) does, so a view drawn over the table doesn't take the clicks meant for
 * the cards and zones inside it.
 */
export function viewEdgeHit(
	bounds: { x: number; y: number; width: number; height: number },
	point: { x: number; y: number },
	band = 16,
): boolean {
	const { x, y, width, height } = bounds;
	const inside =
		point.x >= x - band / 2 &&
		point.x <= x + width + band / 2 &&
		point.y >= y - band / 2 &&
		point.y <= y + height + band / 2;
	if (!inside) return false;
	const inner =
		point.x > x + band / 2 &&
		point.x < x + width - band / 2 &&
		point.y > y + band / 2 &&
		point.y < y + height - band / 2;
	return !inner;
}
