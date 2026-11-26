import { type BoardStore, DEFAULT_STYLE, generateId, type ShapeData } from "@edv4h/usketch-shared";

/**
 * The `tabletop-seat` shape type: a player's place at a game table. Put on a table
 * (`tabletop-table`), it snaps onto the table's outline, facing the table, and the
 * one sitting there sees the table from that side (see `seatViewRect`). A seat that is
 * not on a table is just a marker.
 */
export const SEAT_TYPE = "tabletop-seat";

/** `tabletop-seat` shape meta. */
export interface TabletopSeatMeta {
	/** Shown on the seat (e.g. "Player 1", "Dealer"). */
	label: string;
}

export const DEFAULT_SEAT_SIZE = { width: 160, height: 64 } as const;

/** Read a seat's meta, filling defaults. */
export function readSeatMeta(shape: Pick<ShapeData, "meta">): TabletopSeatMeta {
	const m = (shape.meta ?? {}) as Partial<Record<keyof TabletopSeatMeta, unknown>>;
	return { label: typeof m.label === "string" ? m.label : "" };
}

export function isSeat(shape: Pick<ShapeData, "type"> | undefined): boolean {
	return shape?.type === SEAT_TYPE;
}

export interface CreateSeatShapeParams extends Partial<TabletopSeatMeta> {
	id?: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	rotation?: number;
	/** The table it sits at. */
	parentId?: string;
	zIndex?: string;
}

/** Shape data for a new seat (pass it to `store.addShape` or an add command). */
export function createSeatShape(params: CreateSeatShapeParams): ShapeData {
	return {
		id: params.id ?? generateId(),
		type: SEAT_TYPE,
		x: params.x,
		y: params.y,
		width: params.width ?? DEFAULT_SEAT_SIZE.width,
		height: params.height ?? DEFAULT_SEAT_SIZE.height,
		...(params.rotation ? { rotation: params.rotation } : {}),
		...(params.parentId ? { parentId: params.parentId } : {}),
		...(params.zIndex ? { zIndex: params.zIndex } : {}),
		style: { ...DEFAULT_STYLE },
		meta: readSeatMeta({ meta: { label: params.label } }) as unknown as ShapeData["meta"],
	};
}

/** Rename a seat (fields a host keeps on the meta are kept). False when it is not a seat. */
export function setSeatLabel(store: BoardStore, seatId: string, label: string): boolean {
	const seat = store.getShape(seatId);
	if (!seat || !isSeat(seat) || typeof label !== "string") return false;
	store.updateShape(seatId, {
		meta: { ...(seat.meta ?? {}), label } as unknown as ShapeData["meta"],
	});
	return true;
}

/**
 * The lowest "`prefix` N" no seat is labelled yet ("Player 1", "Player 2", …), so a
 * removed seat's number is reused instead of repeating one still in use.
 */
export function nextSeatLabel(seats: readonly Pick<ShapeData, "meta">[], prefix: string): string {
	const used = new Set(seats.map((s) => readSeatMeta(s).label));
	let n = 1;
	while (used.has(`${prefix} ${n}`)) n++;
	return `${prefix} ${n}`;
}

/** Every seat shape on the board, back to front (at a table or not). */
export function listSeatShapes(store: BoardStore): ShapeData[] {
	return store.getShapesSorted().filter((shape) => isSeat(shape));
}
