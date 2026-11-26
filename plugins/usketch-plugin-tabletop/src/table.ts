import {
	type BoardStore,
	DEFAULT_STYLE,
	generateId,
	type ShapeData,
	safeRotation,
	wrapDeg,
} from "@edv4h/usketch-shared";
import { isSeat } from "./seat.js";
import { VIEW_CAMERAS, type ViewCamera } from "./view.js";
import type { ViewRect } from "./view-camera.js";

/**
 * The `tabletop-table` shape type: a game table. What is put on it becomes its child
 * (so it moves with the table), and seats (`tabletop-seat`) put on it snap onto its
 * outline, facing the table. Sitting at a seat shows the whole table from there (see
 * {@link seatViewRect}). A board can have any number of tables.
 */
export const TABLE_TYPE = "tabletop-table";

/**
 * The table's outline, always fitted to its box:
 * - `rect`    — the box itself
 * - `round`   — the ellipse in the box (a circle in a square box)
 * - `polygon` — a regular polygon of `sides` corners, one corner at the top,
 *               stretched to fill the box
 */
export type TableForm = "rect" | "round" | "polygon";
export const TABLE_FORMS: readonly TableForm[] = ["rect", "round", "polygon"];

export const MIN_TABLE_SIDES = 3;
export const MAX_TABLE_SIDES = 8;

/** `tabletop-table` shape meta. A host may keep its own fields next to these. */
export interface TabletopTableMeta {
	form: TableForm;
	/** Corners of a `polygon` table (3–8). Kept, but unused, for the other forms. */
	sides: number;
	/** How the camera is held on a seat at this table while it is applied. */
	camera: ViewCamera;
}

export const DEFAULT_TABLE_SIZE = { width: 1600, height: 1000 } as const;
const DEFAULT_SIDES = 6;

const isForm = (v: unknown): v is TableForm =>
	typeof v === "string" && (TABLE_FORMS as readonly string[]).includes(v);
const isCamera = (v: unknown): v is ViewCamera =>
	typeof v === "string" && (VIEW_CAMERAS as readonly string[]).includes(v);
const isSides = (v: unknown): v is number =>
	typeof v === "number" && Number.isInteger(v) && v >= MIN_TABLE_SIDES && v <= MAX_TABLE_SIDES;

/** Read a table's meta, filling defaults for missing or unknown values (rect, 6 sides, zoom). */
export function readTableMeta(shape: Pick<ShapeData, "meta">): TabletopTableMeta {
	const m = (shape.meta ?? {}) as Partial<Record<keyof TabletopTableMeta, unknown>>;
	return {
		form: isForm(m.form) ? m.form : "rect",
		sides: isSides(m.sides) ? m.sides : DEFAULT_SIDES,
		camera: isCamera(m.camera) ? m.camera : "zoom",
	};
}

export function isTable(shape: Pick<ShapeData, "type"> | undefined): boolean {
	return shape?.type === TABLE_TYPE;
}

export interface CreateTableShapeParams extends Partial<TabletopTableMeta> {
	id?: string;
	x: number;
	y: number;
	width?: number;
	height?: number;
	zIndex?: string;
}

/** Shape data for a new table (pass it to `store.addShape` or an add command). */
export function createTableShape(params: CreateTableShapeParams): ShapeData {
	const meta = readTableMeta({
		meta: { form: params.form, sides: params.sides, camera: params.camera },
	});
	return {
		id: params.id ?? generateId(),
		type: TABLE_TYPE,
		x: params.x,
		y: params.y,
		width: params.width ?? DEFAULT_TABLE_SIZE.width,
		height: params.height ?? DEFAULT_TABLE_SIZE.height,
		...(params.zIndex ? { zIndex: params.zIndex } : {}),
		style: { ...DEFAULT_STYLE },
		meta: meta as unknown as ShapeData["meta"],
	};
}

/** The board's tables, back to front (hidden ones too). */
export function listTables(store: BoardStore): ShapeData[] {
	return store.getShapesSorted().filter((shape) => isTable(shape));
}

/**
 * Patch a table's meta (fields the host keeps on the meta are kept; unknown values
 * are dropped). Returns false when `tableId` is not a table.
 */
export function updateTableMeta(
	store: BoardStore,
	tableId: string,
	patch: Partial<TabletopTableMeta>,
): boolean {
	const table = store.getShape(tableId);
	if (!table || !isTable(table)) return false;
	const next = readTableMeta({ meta: { ...(table.meta ?? {}), ...patch } });
	store.updateShape(tableId, {
		meta: { ...(table.meta ?? {}), ...next } as unknown as ShapeData["meta"],
	});
	return true;
}

/** Change a table's form (and the corners of a polygon). Unknown values are dropped. */
export const setTableForm = (
	store: BoardStore,
	tableId: string,
	form: TableForm,
	sides?: number,
): boolean =>
	isForm(form) &&
	updateTableMeta(
		store,
		tableId,
		sides !== undefined && isSides(sides) ? { form, sides } : { form },
	);

export const setTableCamera = (store: BoardStore, tableId: string, camera: ViewCamera): boolean =>
	isCamera(camera) && updateTableMeta(store, tableId, { camera });

// ── The outline ──────────────────────────────────────────────────────────────

export interface Point {
	x: number;
	y: number;
}

/** Corners drawn for a `round` table (its outline is a polygon this fine). */
const ROUND_SEGMENTS = 96;

/**
 * The table's outline in its own box (from its top left, unturned), clockwise. For
 * `round` it is a fine polygon. A host's look can draw it (e.g. an SVG `points`).
 */
export function tableOutlineLocal(table: Pick<ShapeData, "width" | "height" | "meta">): Point[] {
	const { width: w, height: h } = table;
	const { form, sides } = readTableMeta(table);
	if (form === "rect") {
		return [
			{ x: 0, y: 0 },
			{ x: w, y: 0 },
			{ x: w, y: h },
			{ x: 0, y: h },
		];
	}
	const n = form === "round" ? ROUND_SEGMENTS : sides;
	// A unit polygon with a corner at the top, then stretched to fill the box (an odd
	// polygon is not as tall as it is wide, so it would leave a gap at the bottom).
	const unit = Array.from({ length: n }, (_, i) => {
		const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
		return { x: Math.cos(a), y: Math.sin(a) };
	});
	const xs = unit.map((p) => p.x);
	const ys = unit.map((p) => p.y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const spanX = Math.max(...xs) - minX;
	const spanY = Math.max(...ys) - minY;
	return unit.map((p) => ({ x: ((p.x - minX) / spanX) * w, y: ((p.y - minY) / spanY) * h }));
}

type Placed = Pick<ShapeData, "x" | "y" | "width" | "height" | "rotation">;
type PlacedTable = Placed & Pick<ShapeData, "meta">;

/** Box-local (unturned, from the top left) → board. */
function toWorld(table: Placed, p: Point): Point {
	const rad = (safeRotation(table.rotation) * Math.PI) / 180;
	const dx = p.x - table.width / 2;
	const dy = p.y - table.height / 2;
	return {
		x: table.x + table.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad),
		y: table.y + table.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad),
	};
}

/** Board → box-local (unturned, from the top left). */
function toLocal(table: Placed, p: Point): Point {
	const rad = (-safeRotation(table.rotation) * Math.PI) / 180;
	const dx = p.x - (table.x + table.width / 2);
	const dy = p.y - (table.y + table.height / 2);
	return {
		x: table.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad),
		y: table.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad),
	};
}

/** The table's outline on the board (turned with the table), clockwise. */
export function tableOutline(table: PlacedTable): Point[] {
	return tableOutlineLocal(table).map((p) => toWorld(table, p));
}

/** Whether a board point is on the table (inside its outline). */
export function isOnTable(table: PlacedTable, point: Point): boolean {
	const outline = tableOutlineLocal(table);
	const p = toLocal(table, point);
	let inside = false;
	for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
		const a = outline[i] as Point;
		const b = outline[j] as Point;
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside;
		}
	}
	return inside;
}

/** A point on a table's outline and the turn that faces the table from there. */
export interface OutlinePoint extends Point {
	/**
	 * How a seat there is turned so it faces the table (degrees, clockwise, like a
	 * shape's `rotation`): its bottom points out of the table. Also the camera turn that
	 * shows the table from there (see {@link seatViewRect}).
	 */
	rotation: number;
}

/** The turn whose "down" is the direction (nx, ny) (a unit vector, screen axes: y down). */
const turnFacing = (nx: number, ny: number): number =>
	wrapDeg((Math.atan2(-nx, ny) * 180) / Math.PI);

/** The nearest point on the outline to a board point, and the turn facing in from there. */
export function nearestOnOutline(table: PlacedTable, point: Point): OutlinePoint {
	const outline = tableOutlineLocal(table);
	const p = toLocal(table, point);
	let best = { x: 0, y: 0, d: Number.POSITIVE_INFINITY, nx: 0, ny: 1 };
	for (let i = 0; i < outline.length; i++) {
		const a = outline[i] as Point;
		const b = outline[(i + 1) % outline.length] as Point;
		const ex = b.x - a.x;
		const ey = b.y - a.y;
		const len2 = ex * ex + ey * ey;
		if (len2 === 0) continue;
		const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2));
		const qx = a.x + ex * t;
		const qy = a.y + ey * t;
		const d = (p.x - qx) ** 2 + (p.y - qy) ** 2;
		if (d < best.d) {
			const len = Math.sqrt(len2);
			// A clockwise outline (y down) has the outside on the left of travel.
			best = { x: qx, y: qy, d, nx: ey / len, ny: -ex / len };
		}
	}
	if (readTableMeta(table).form === "round") {
		// The ellipse's own normal, so a seat turns smoothly instead of segment by segment.
		const rx = table.width / 2;
		const ry = table.height / 2;
		const gx = (best.x - rx) / (rx * rx);
		const gy = (best.y - ry) / (ry * ry);
		const g = Math.hypot(gx, gy);
		if (g > 0) best = { ...best, nx: gx / g, ny: gy / g };
	}
	const world = toWorld(table, best);
	return {
		x: world.x,
		y: world.y,
		rotation: wrapDeg(safeRotation(table.rotation) + turnFacing(best.nx, best.ny)),
	};
}

/** The outline's length. */
function perimeter(outline: readonly Point[]): number {
	let sum = 0;
	for (let i = 0; i < outline.length; i++) {
		const a = outline[i] as Point;
		const b = outline[(i + 1) % outline.length] as Point;
		sum += Math.hypot(b.x - a.x, b.y - a.y);
	}
	return sum;
}

/** The point `distance` along the outline from its first corner. */
function alongOutline(outline: readonly Point[], distance: number): Point {
	let left = distance;
	for (let i = 0; i < outline.length; i++) {
		const a = outline[i] as Point;
		const b = outline[(i + 1) % outline.length] as Point;
		const len = Math.hypot(b.x - a.x, b.y - a.y);
		if (left <= len && len > 0) {
			return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len };
		}
		left -= len;
	}
	return outline[0] ?? { x: 0, y: 0 };
}

/** Where a seat goes: its box's top left and its turn. */
export interface SeatPlacement {
	x: number;
	y: number;
	rotation: number;
}

/**
 * Where a seat of `size` sits so it touches the outline from inside, facing the
 * table, nearest `near` (a board point, e.g. where it was dropped). Staying inside
 * keeps it on a table that adopts shapes by their center.
 */
export function seatPlacement(
	table: PlacedTable,
	near: Point,
	size: { width: number; height: number },
): SeatPlacement {
	const at = nearestOnOutline(table, near);
	// Step in from the outline by half the seat's height, against the seat's "down".
	const rad = (at.rotation * Math.PI) / 180;
	const half = size.height / 2;
	const cx = at.x + Math.sin(rad) * half;
	const cy = at.y - Math.cos(rad) * half;
	return { x: cx - size.width / 2, y: cy - size.height / 2, rotation: at.rotation };
}

const centerOf = (s: Pick<ShapeData, "x" | "y" | "width" | "height">): Point => ({
	x: s.x + s.width / 2,
	y: s.y + s.height / 2,
});

const SAME = 1e-6;

/**
 * The table's `container.layout`: the seats among its children go on the outline
 * (nearest their center, facing the table). Its other children stay where they are.
 */
export function layoutTable({
	container,
	children,
}: {
	container: ShapeData;
	children: readonly ShapeData[];
}): { id: string; patch: Partial<ShapeData> }[] {
	return children
		.filter((child) => isSeat(child))
		.map((seat) => ({ seat, to: seatPlacement(container, centerOf(seat), seat) }))
		.filter(
			({ seat, to }) =>
				Math.abs(seat.x - to.x) > SAME ||
				Math.abs(seat.y - to.y) > SAME ||
				Math.abs(wrapDeg(safeRotation(seat.rotation) - to.rotation)) > SAME,
		)
		.map(({ seat, to }) => ({ id: seat.id, patch: { ...to } }));
}

/**
 * Where `count` seats of `size` go to be spread evenly round the table, clockwise
 * from the middle of its bottom.
 */
export function spreadPlacements(
	table: PlacedTable,
	count: number,
	size: { width: number; height: number },
): SeatPlacement[] {
	if (count <= 0) return [];
	const local = tableOutlineLocal(table);
	const total = perimeter(local);
	// Start where a line straight down from the centre meets the outline: walk the
	// outline once and keep the lowest point nearest the middle.
	const steps = 720;
	let start = 0;
	let best = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < steps; i++) {
		const d = (total * i) / steps;
		const q = alongOutline(local, d);
		const score = q.y - Math.abs(q.x - table.width / 2) * 1e-3;
		if (score > best + 1e-9) {
			best = score;
			start = d;
		}
	}
	return Array.from({ length: count }, (_, i) => {
		const q = alongOutline(local, (start + (total * i) / count) % total);
		return seatPlacement(table, toWorld(table, q), size);
	});
}

// ── What a seat sees ─────────────────────────────────────────────────────────

/** The box round the outline seen turned by `rotation`, as a {@link ViewRect}, grown by `margin`. */
function outlineRect(table: PlacedTable, rotation: number, margin: number): ViewRect {
	const rad = (rotation * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	// Turn the outline back by `rotation`, box it, then turn the box's centre forward.
	const turned = tableOutline(table).map((p) => ({
		x: p.x * cos + p.y * sin,
		y: -p.x * sin + p.y * cos,
	}));
	const xs = turned.map((p) => p.x);
	const ys = turned.map((p) => p.y);
	const minX = Math.min(...xs) - margin;
	const maxX = Math.max(...xs) + margin;
	const minY = Math.min(...ys) - margin;
	const maxY = Math.max(...ys) + margin;
	const c = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
	const width = maxX - minX;
	const height = maxY - minY;
	const rect: ViewRect = {
		x: c.x * cos - c.y * sin - width / 2,
		y: c.x * sin + c.y * cos - height / 2,
		width,
		height,
	};
	const r = wrapDeg(rotation);
	if (r !== 0) rect.rotation = r;
	return rect;
}

/** The whole table (grown by `margin`), upright as the table is (for an overview). */
export function tableViewRect(table: PlacedTable, margin = 0): ViewRect {
	return outlineRect(table, safeRotation(table.rotation), margin);
}

/**
 * What a seat sees: the whole table (grown by `margin`), turned so the seat is at the
 * bottom of the screen. Pass it to `applyViewCamera`. It is worked out from where the
 * seat is, so it holds even before the table has laid the seat out.
 */
export function seatViewRect(
	table: PlacedTable,
	seat: Pick<ShapeData, "x" | "y" | "width" | "height">,
	margin = 0,
): ViewRect {
	return outlineRect(table, nearestOnOutline(table, centerOf(seat)).rotation, margin);
}

// ── Seats at tables ──────────────────────────────────────────────────────────

/** A seat and the table it is at. */
export interface SeatAtTable {
	table: ShapeData;
	seat: ShapeData;
}

/** Clockwise from the bottom: 0 at the bottom, 90 on the left, 180 at the top, 270 on the right. */
const clockwiseFromBottom = (table: PlacedTable, seat: ShapeData): number => {
	const turn = wrapDeg(
		nearestOnOutline(table, centerOf(seat)).rotation - safeRotation(table.rotation),
	);
	return turn < 0 ? turn + 360 : turn;
};

/** The seats at a table, clockwise from the bottom (as seen with the table upright). */
export function seatsAtTable(store: BoardStore, tableId: string): ShapeData[] {
	const table = store.getShape(tableId);
	if (!table || !isTable(table)) return [];
	return store
		.getShapesSorted()
		.filter((s) => isSeat(s) && s.parentId === tableId)
		.map((seat) => ({ seat, at: clockwiseFromBottom(table, seat) }))
		.sort((a, b) => a.at - b.at)
		.map(({ seat }) => seat);
}

/** Every seat at a table on the board, table by table (back to front). */
export function listSeats(store: BoardStore): SeatAtTable[] {
	return listTables(store).flatMap((table) =>
		seatsAtTable(store, table.id).map((seat) => ({ table, seat })),
	);
}

/** The seat with this id and its table, or `undefined` (also when it is at no table). */
export function findSeat(store: BoardStore, seatId: string): SeatAtTable | undefined {
	const seat = store.getShape(seatId);
	if (!seat || !isSeat(seat) || typeof seat.parentId !== "string") return undefined;
	const table = store.getShape(seat.parentId);
	return table && isTable(table) ? { table, seat } : undefined;
}

/**
 * Moves that spread a table's seats evenly round it, keeping their order (wrap them
 * in an update command to undo them). Empty when the table has no seats.
 */
export function spreadSeatUpdates(
	store: BoardStore,
	tableId: string,
): { id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }[] {
	const table = store.getShape(tableId);
	if (!table || !isTable(table)) return [];
	const seats = seatsAtTable(store, tableId);
	return seats.map((seat, i) => {
		const [to] = spreadPlacements(table, seats.length, seat).slice(i, i + 1);
		return {
			id: seat.id,
			from: { x: seat.x, y: seat.y, rotation: seat.rotation },
			to: to ? { ...to } : {},
		};
	});
}
