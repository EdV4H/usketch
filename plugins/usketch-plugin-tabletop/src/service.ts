import {
	type BoardStore,
	defineService,
	type ServiceRegistry,
	type ShapeData,
} from "@edv4h/usketch-shared";
import { type CreateSeatShapeParams, createSeatShape, setSeatLabel } from "./seat.js";
import {
	type CreateTableShapeParams,
	createTableShape,
	listSeats,
	listTables,
	type SeatAtTable,
	setTableCamera,
	setTableForm,
	type TableForm,
} from "./table.js";
import {
	type CreateViewShapeParams,
	createViewShape,
	listViews,
	setViewCamera,
	setViewLabel,
	type ViewCamera,
} from "./view.js";
import {
	type CreateZoneShapeParams,
	createZoneShape,
	type ZoneAlign,
	type ZoneArrange,
	type ZoneFace,
} from "./zone.js";
import {
	setZoneAccepts,
	setZoneAlign,
	setZoneArrange,
	setZoneFace,
	setZoneLabel,
	zoneContents,
	zoneCount,
	zoneOf,
} from "./zone-ops.js";

/** The tabletop plugin's host-facing operations (store-bound). */
export interface TabletopApi {
	/** Add a zone (not undoable; wrap `createZoneShape` in an add command for undo). */
	addZone(params: CreateZoneShapeParams): ShapeData;
	setLabel(zoneId: string, label: string): boolean;
	setArrange(zoneId: string, arrange: ZoneArrange): boolean;
	setAlign(zoneId: string, align: ZoneAlign): boolean;
	setFace(zoneId: string, face: ZoneFace): boolean;
	setAccepts(zoneId: string, accepts: readonly string[]): boolean;
	/** The zone a shape is in, or `undefined`. */
	zoneOf(shapeId: string): ShapeData | undefined;
	contents(zoneId: string): ShapeData[];
	count(zoneId: string): number;
	/** Add a player view (not undoable; wrap `createViewShape` in an add command for undo). */
	addView(params: CreateViewShapeParams): ShapeData;
	setViewLabel(viewId: string, label: string): boolean;
	setViewCamera(viewId: string, camera: ViewCamera): boolean;
	/** The board's player views, back to front. */
	views(): ShapeData[];
	/** Add a game table (not undoable; wrap `createTableShape` in an add command for undo). */
	addTable(params: CreateTableShapeParams): ShapeData;
	/**
	 * Add a seat (not undoable). Give `parentId` to put it at a table: it is laid onto
	 * the outline by the table's layout.
	 */
	addSeat(params: CreateSeatShapeParams): ShapeData;
	setSeatLabel(seatId: string, label: string): boolean;
	setTableForm(tableId: string, form: TableForm, sides?: number): boolean;
	setTableCamera(tableId: string, camera: ViewCamera): boolean;
	/** The board's game tables, back to front. */
	tables(): ShapeData[];
	/** Every seat at a table, table by table, each table's clockwise from the bottom. */
	seats(): SeatAtTable[];
}

export const tabletopService = defineService<TabletopApi>("usketch-plugin-tabletop");

export function createTabletopApi(store: BoardStore): TabletopApi {
	return {
		addZone(params) {
			const zone = createZoneShape(params);
			store.addShape(zone);
			return zone;
		},
		setLabel: (id, label) => setZoneLabel(store, id, label),
		setArrange: (id, arrange) => setZoneArrange(store, id, arrange),
		setAlign: (id, align) => setZoneAlign(store, id, align),
		setFace: (id, face) => setZoneFace(store, id, face),
		setAccepts: (id, accepts) => setZoneAccepts(store, id, accepts),
		zoneOf: (id) => zoneOf(store, id),
		contents: (id) => zoneContents(store, id),
		count: (id) => zoneCount(store, id),
		addView(params) {
			const view = createViewShape(params);
			store.addShape(view);
			return view;
		},
		setViewLabel: (id, label) => setViewLabel(store, id, label),
		setViewCamera: (id, camera) => setViewCamera(store, id, camera),
		views: () => listViews(store),
		addTable(params) {
			const table = createTableShape(params);
			store.addShape(table);
			return table;
		},
		addSeat(params) {
			const seat = createSeatShape(params);
			store.addShape(seat);
			return seat;
		},
		setSeatLabel: (id, label) => setSeatLabel(store, id, label),
		setTableForm: (id, form, sides) => setTableForm(store, id, form, sides),
		setTableCamera: (id, camera) => setTableCamera(store, id, camera),
		tables: () => listTables(store),
		seats: () => listSeats(store),
	};
}

/** Host accessor: `getTabletopApi(app.services)?.setArrange(id, "spread")`. */
export function getTabletopApi(services: ServiceRegistry): TabletopApi | undefined {
	return tabletopService.get(services);
}
