import { DEFAULT_STYLE, generateId, type ShapeData } from "@edv4h/usketch-shared";

/** The `tabletop-zone` shape type: a place on a game table that holds cards / pieces. */
export const ZONE_TYPE = "tabletop-zone";

/**
 * How a zone lays out what it holds.
 * - `pile`   — stacked on its center (a deck, a discard pile)
 * - `spread` — side by side, overlapping when it runs out of room (a hand, a row)
 * - `grid`   — in rows and columns (a market, a board of cards)
 * - `free`   — left where they are dropped
 */
export type ZoneArrange = "pile" | "spread" | "grid" | "free";
export const ZONE_ARRANGES: readonly ZoneArrange[] = ["pile", "spread", "grid", "free"];

/**
 * Which way up a shape is turned when it is dropped in the zone (see
 * `CreateTabletopPluginOptions.turnFace`). `keep` leaves it as it was.
 */
export type ZoneFace = "keep" | "up" | "down";
export const ZONE_FACES: readonly ZoneFace[] = ["keep", "up", "down"];

/** `tabletop-zone` shape meta. */
export interface TabletopZoneMeta {
	/** Shown on the zone (e.g. "Deck", "Discard"). */
	label: string;
	arrange: ZoneArrange;
	face: ZoneFace;
	/** Shape types the zone takes. Empty = any shape the host accepts. */
	accepts: string[];
}

export const DEFAULT_ZONE_SIZE = { width: 140, height: 196 } as const;

const isArrange = (v: unknown): v is ZoneArrange =>
	typeof v === "string" && (ZONE_ARRANGES as readonly string[]).includes(v);
const isFace = (v: unknown): v is ZoneFace =>
	typeof v === "string" && (ZONE_FACES as readonly string[]).includes(v);

/** Read a zone's meta, filling defaults for missing or unknown values. */
export function readZoneMeta(shape: Pick<ShapeData, "meta">): TabletopZoneMeta {
	const m = (shape.meta ?? {}) as Partial<Record<keyof TabletopZoneMeta, unknown>>;
	return {
		label: typeof m.label === "string" ? m.label : "",
		arrange: isArrange(m.arrange) ? m.arrange : "pile",
		face: isFace(m.face) ? m.face : "keep",
		accepts: Array.isArray(m.accepts)
			? m.accepts.filter((t): t is string => typeof t === "string")
			: [],
	};
}

export function isZone(shape: Pick<ShapeData, "type"> | undefined): boolean {
	return shape?.type === ZONE_TYPE;
}

export interface CreateZoneShapeParams extends Partial<TabletopZoneMeta> {
	id?: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	zIndex?: string;
}

/** Shape data for a new zone (pass it to `store.addShape` or an add command). */
export function createZoneShape(params: CreateZoneShapeParams): ShapeData {
	const meta: TabletopZoneMeta = readZoneMeta({
		meta: {
			label: params.label,
			arrange: params.arrange,
			face: params.face,
			accepts: params.accepts,
		},
	});
	return {
		id: params.id ?? generateId(),
		type: ZONE_TYPE,
		x: params.x,
		y: params.y,
		width: params.width ?? DEFAULT_ZONE_SIZE.width,
		height: params.height ?? DEFAULT_ZONE_SIZE.height,
		...(params.zIndex ? { zIndex: params.zIndex } : {}),
		style: { ...DEFAULT_STYLE },
		meta: meta as unknown as ShapeData["meta"],
	};
}

/** Whether `zone` takes `child` by its own `accepts` list (empty = any). */
export function zoneAcceptsType(zone: Pick<ShapeData, "meta">, child: Pick<ShapeData, "type">) {
	const { accepts } = readZoneMeta(zone);
	return accepts.length === 0 || accepts.includes(child.type);
}
