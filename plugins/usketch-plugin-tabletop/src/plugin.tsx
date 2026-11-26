import { createResize, getBounds } from "@edv4h/usketch-shape-utils";
import {
	type CanvasPointerEvent,
	getScreenSize,
	isShapeContainer,
	PERMISSIONS,
	type PluginContext,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
	zIndexBetween,
} from "@edv4h/usketch-shared";
import {
	createAddShapeCommand,
	createAddShapesCommand,
	createBatchUpdateShapesCommand,
} from "@edv4h/usketch-store";
import type { ReactElement } from "react";
import { arrangeZone, type ZoneArrangeOptions } from "./arrange.js";
import { setupAttachWatch, type TurnFace, type ZoneAttachEvent } from "./attach-watch.js";
import { DefaultSeat, type TabletopSeatRenderProps } from "./render-seat.js";
import { DefaultTable, type TabletopTableRenderProps } from "./render-table.js";
import { DefaultView, type TabletopViewRenderProps, VIEW_LABEL_HEIGHT } from "./render-view.js";
import { DefaultZone, type TabletopZoneRenderProps, ZoneView } from "./render-zone.js";
import {
	createSeatShape,
	isSeat,
	listSeatShapes,
	nextSeatLabel,
	readSeatMeta,
	SEAT_TYPE,
	setSeatLabel,
} from "./seat.js";
import { createTabletopApi, tabletopService } from "./service.js";
import {
	createTableShape,
	createTableWithSeats,
	DEFAULT_TABLE_SIZE,
	isOnTable,
	isTable,
	layoutTable,
	MAX_TABLE_SIDES,
	MIN_TABLE_SIDES,
	readTableMeta,
	roomiestSeatPlacement,
	setTableCamera,
	setTableForm,
	spreadSeatUpdates,
	TABLE_FORMS,
	TABLE_TYPE,
	type TableForm,
	tableOutlineLocal,
} from "./table.js";
import {
	createViewShape,
	isView,
	listViews,
	nextViewLabel,
	readViewMeta,
	setViewCamera,
	setViewLabel,
	VIEW_CAMERAS,
	VIEW_TYPE,
	type ViewCamera,
	viewEdgeHit,
	viewLabelWidth,
} from "./view.js";
import { screenViewRect } from "./view-camera.js";
import {
	createZoneShape,
	DEFAULT_ZONE_SIZE,
	isZone,
	readZoneMeta,
	ZONE_ALIGNS,
	ZONE_ARRANGES,
	ZONE_FACES,
	ZONE_TYPE,
	type ZoneAlign,
	type ZoneArrange,
	type ZoneFace,
	zoneAcceptsType,
} from "./zone.js";
import { setZoneAlign, setZoneArrange, setZoneFace, setZoneLabel } from "./zone-ops.js";

export const ZONE_TOOL_ID = "tabletop-zone-draw";

export interface CreateTabletopPluginOptions {
	/** The zone's look. Default: a dashed frame with the label (and the count of a pile). */
	render?: (props: TabletopZoneRenderProps) => ReactElement;
	/**
	 * Which shapes zones take, on top of each zone's own `accepts` list. Default:
	 * anything but connectors. Zones never take other zones.
	 */
	accepts?: (child: ShapeData, zone: ShapeData) => boolean;
	/**
	 * Turns a dropped shape up or down for zones whose `face` is `up` / `down`.
	 * Without it, `face` does nothing. For cards: `cardTurnFace` from
	 * `@edv4h/usketch-plugin-shape-card`.
	 */
	turnFace?: TurnFace;
	/** The local user dropped a shape into a zone. */
	onAttach?: (event: ZoneAttachEvent) => void;
	/** The local user took a shape out of a zone. */
	onDetach?: (event: ZoneAttachEvent) => void;
	/** Size of a zone placed by a click. Default 140 × 196 (a card and a margin). */
	defaultSize?: { width: number; height: number };
	/** Spacing used by the arrangements. */
	arrange?: ZoneArrangeOptions;
	/** Register the zone drawing tool. Default true. */
	tool?: boolean;
	/**
	 * Register the player view shape (`tabletop-view`). Default true. Bringing the
	 * camera to a view is the host's call (`applyViewCamera`), e.g. when play starts.
	 */
	views?: boolean;
	/** A view's look. Default: a dashed frame with a camera mark and the label. */
	renderView?: (props: TabletopViewRenderProps) => ReactElement;
	/**
	 * Register the game table (`tabletop-table`) and seat (`tabletop-seat`) shapes.
	 * Default true. What is put on a table becomes its child and moves with it; seats
	 * snap onto its outline. Bringing the camera to a seat is the host's call
	 * (`seatViewRect` + `applyViewCamera`).
	 */
	tables?: boolean;
	/** A table's look. Default: a green table with a wooden rim, in the table's form. */
	renderTable?: (props: TabletopTableRenderProps) => ReactElement;
	/** A seat's look. Default: a white tag with a person mark and the label. */
	renderSeat?: (props: TabletopSeatRenderProps) => ReactElement;
}

function ZoneIcon(): ReactElement {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
			<title>Zone</title>
			<rect x="4" y="2.5" width="12" height="15" rx="2" strokeWidth="1.5" strokeDasharray="2.5 2" />
			<rect x="7" y="6" width="6" height="8" rx="1" strokeWidth="1.2" />
		</svg>
	);
}

const ARRANGE_LABELS: Record<ZoneArrange, string> = {
	pile: "Pile",
	spread: "Spread",
	grid: "Grid",
	free: "Free",
};
const ALIGN_LABELS: Record<ZoneAlign, string> = {
	start: "Left",
	center: "Center",
	end: "Right",
};
const FORM_LABELS: Record<TableForm, string> = {
	rect: "Rectangle",
	round: "Round",
	polygon: "Polygon",
};
const CAMERA_LABELS: Record<ViewCamera, string> = {
	fixed: "Fixed",
	zoom: "Zoom in only",
	free: "Free",
};
const FACE_LABELS: Record<ZoneFace, string> = {
	keep: "As dropped",
	up: "Face up",
	down: "Face down",
};

/**
 * Tabletop parts for playing games on the board. For now: **zones**
 * (`tabletop-zone`), places that hold cards or pieces — a deck, a discard
 * pile, a player's row. A shape dropped with its center on a zone snaps into
 * it and is laid out by the zone's `arrange` (pile / spread / grid / free).
 *
 * Needs `@edv4h/usketch-plugin-container` (the zone is a container with
 * `autoAttach`, `attachHit: "center"` and `accepts`). Register this plugin
 * after it. The look is the host's (`render`); the default is a plain frame.
 */
export function createTabletopPlugin(opts: CreateTabletopPluginOptions = {}): UsketchPlugin {
	const size = opts.defaultSize ?? DEFAULT_ZONE_SIZE;
	const renderLook = opts.render ?? ((props) => <DefaultZone {...props} />);
	const hostAccepts = opts.accepts ?? ((child) => child.type !== "connector");
	const renderViewLook = opts.renderView ?? ((props) => <DefaultView {...props} />);
	const renderTableLook = opts.renderTable ?? ((props) => <DefaultTable {...props} />);
	const renderSeatLook = opts.renderSeat ?? ((props) => <DefaultSeat {...props} />);

	return {
		id: "usketch-plugin-tabletop",
		name: "テーブルゲーム",

		setup(ctx: PluginContext) {
			const resize = createResize(40, 40);

			ctx.shapes.register(ZONE_TYPE, {
				render: (zone) => <ZoneView store={ctx.store} zone={zone} render={renderLook} />,
				getBounds,
				hitTest: withRotation((data, point) => {
					const b = getBounds(data);
					return (
						point.x >= b.x &&
						point.x <= b.x + b.width &&
						point.y >= b.y &&
						point.y <= b.y + b.height
					);
				}),
				resize,
				createDefault: ({ id, x, y }) => createZoneShape({ id, x, y, ...size }),
				renderTarget: "html",
				minSize: { width: 40, height: 40 },
				container: {
					selectableChildren: true,
					// A zone usually sits on a board picture: a click on the zone must pick
					// the zone, not the picture behind it.
					winsOverBackdrop: true,
					autoAttach: true,
					attachHit: "center",
					accepts: (child, zone) =>
						!isZone(child) &&
						!isView(child) &&
						!isTable(child) &&
						!isSeat(child) &&
						!isShapeContainer(ctx.shapes.get(child.type), child) &&
						hostAccepts(child, zone) &&
						zoneAcceptsType(zone, child),
					layout: ({ container, children }) => arrangeZone(container, children, opts.arrange),
				},
				debugFields: (shape) => {
					const m = readZoneMeta(shape);
					return { ...m, accepts: m.accepts.join(",") };
				},
			});

			if (opts.views !== false) {
				ctx.shapes.register(VIEW_TYPE, {
					render: (view) => renderViewLook({ view, meta: readViewMeta(view) }),
					getBounds,
					// The edge and the label strip only: a view over the table must not take
					// the clicks meant for what is inside it.
					hitTest: withRotation((data, point) => {
						const b = getBounds(data);
						if (viewEdgeHit(b, point)) return true;
						const { label } = readViewMeta(data);
						if (!label) return false;
						return (
							point.x >= b.x &&
							point.x <= b.x + Math.min(b.width, viewLabelWidth(label)) &&
							point.y >= b.y &&
							point.y <= b.y + Math.min(b.height, VIEW_LABEL_HEIGHT)
						);
					}),
					resize,
					createDefault: ({ id, x, y }) => createViewShape({ id, x, y }),
					renderTarget: "html",
					minSize: { width: 80, height: 60 },
					debugFields: (shape) => ({ ...readViewMeta(shape) }),
				});
			}

			if (opts.tables !== false) {
				const boxHit = withRotation((data, point) => {
					const b = getBounds(data);
					return (
						point.x >= b.x &&
						point.x <= b.x + b.width &&
						point.y >= b.y &&
						point.y <= b.y + b.height
					);
				});
				ctx.shapes.register(TABLE_TYPE, {
					render: (table) =>
						renderTableLook({
							table,
							meta: readTableMeta(table),
							outline: tableOutlineLocal(table),
						}),
					getBounds,
					// Inside the outline: it is what the zones and cards sit on. Those in front
					// of it still win the click (they are hit first, and are its children).
					hitTest: (data, point) => isOnTable(data, point),
					resize,
					createDefault: ({ id, x, y }) => createTableShape({ id, x, y }),
					renderTarget: "html",
					minSize: { width: 200, height: 200 },
					// What is put on the table becomes its child, so moving the table takes the
					// zones, cards and seats on it along (like a frame). A shape joins when its
					// center is on the table (inside the outline), and stays selectable on its
					// own. The layout puts the seats on the outline.
					container: {
						selectableChildren: true,
						winsOverBackdrop: true,
						autoAttach: true,
						attachHit: "center",
						accepts: (child, table) =>
							!isTable(child) &&
							!isView(child) &&
							child.type !== "connector" &&
							isOnTable(table, {
								x: child.x + child.width / 2,
								y: child.y + child.height / 2,
							}),
						layout: layoutTable,
					},
					debugFields: (shape) => ({ ...readTableMeta(shape) }),
				});
				ctx.shapes.register(SEAT_TYPE, {
					render: (seat) => renderSeatLook({ seat, meta: readSeatMeta(seat) }),
					getBounds,
					hitTest: boxHit,
					resize,
					createDefault: ({ id, x, y }) =>
						createSeatShape({
							id,
							x,
							y,
							label: nextSeatLabel(listSeatShapes(ctx.store), "Player"),
						}),
					renderTarget: "html",
					minSize: { width: 40, height: 32 },
					debugFields: (shape) => ({ ...readSeatMeta(shape) }),
				});
			}

			const offWatch = setupAttachWatch(ctx, {
				turnFace: opts.turnFace,
				onAttach: opts.onAttach,
				onDetach: opts.onDetach,
			});

			// ── Tool: drag a zone out, or click for the default size ──
			let draw: { startX: number; startY: number; id: string } | null = null;
			if (opts.tool !== false) {
				ctx.tools.register(ZONE_TOOL_ID, {
					icon: ZoneIcon,
					cursor: "crosshair",
					order: 29,
					onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
						// Primary button only, and one zone at a time (a second finger or a
						// pen + finger must not leave the first draft behind).
						if (event.button !== 0 || draw) return;
						const { x, y } = event.worldPoint;
						const draft = createZoneShape({ x, y, width: 0, height: 0 });
						draw = { startX: x, startY: y, id: draft.id };
						toolCtx.store.addShape(draft);
					},
					onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
						if (!draw) return;
						const { x, y } = event.worldPoint;
						toolCtx.store.updateShape(draw.id, {
							x: Math.min(draw.startX, x),
							y: Math.min(draw.startY, y),
							width: Math.abs(x - draw.startX),
							height: Math.abs(y - draw.startY),
						});
					},
					onPointerUp(toolCtx: ToolContext) {
						if (!draw) return;
						const draft = toolCtx.store.getShape(draw.id);
						toolCtx.store.deleteShape(draw.id);
						const placed =
							draft && draft.width > 10 && draft.height > 10
								? draft
								: createZoneShape({
										id: draw.id,
										x: draw.startX - size.width / 2,
										y: draw.startY - size.height / 2,
										...size,
									});
						toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, placed));
						toolCtx.store.setSelection([placed.id]);
						draw = null;
						toolCtx.store.resetToDefaultTool();
					},
					onDeactivate() {
						if (draw) {
							ctx.store.deleteShape(draw.id);
							draw = null;
						}
					},
				});
			}

			// ── HUD actions on the selected zone ──
			const selectedZone = (): string | undefined => {
				for (const id of ctx.store.getSelection()) {
					if (isZone(ctx.store.getShape(id))) return id;
				}
				return undefined;
			};
			const selectedView = (): string | undefined => {
				for (const id of ctx.store.getSelection()) {
					if (isView(ctx.store.getShape(id))) return id;
				}
				return undefined;
			};
			const viewActions =
				opts.views === false
					? []
					: [
							ctx.actions.register({
								id: "tabletop-view:add",
								requires: PERMISSIONS.pageEdit,
								label: "Add player view",
								group: "Tabletop",
								run: () => {
									// What is on screen now becomes the view (turned like the camera).
									const area = screenViewRect(ctx.store.getViewport(), getScreenSize());
									const view = createViewShape({
										...area,
										label: nextViewLabel(listViews(ctx.store), "View"),
									});
									ctx.commands.execute(createAddShapeCommand(ctx.store, view));
									ctx.store.setSelection([view.id]);
								},
							}),
							ctx.actions.register({
								id: "tabletop-view:camera",
								requires: PERMISSIONS.pageEdit,
								label: "View camera",
								group: "Tabletop",
								params: [
									{
										name: "camera",
										type: "enum",
										// No default: confirming without a pick must not reset the view's camera.
										options: VIEW_CAMERAS.map((value) => ({ value, label: CAMERA_LABELS[value] })),
									},
								],
								isEnabled: () => selectedView() !== undefined,
								run: ({ camera }) => {
									const id = selectedView();
									if (id && VIEW_CAMERAS.includes(camera as ViewCamera)) {
										setViewCamera(ctx.store, id, camera as ViewCamera);
									}
								},
							}),
							ctx.actions.register({
								id: "tabletop-view:label",
								requires: PERMISSIONS.pageEdit,
								label: "View label",
								group: "Tabletop",
								params: [{ name: "label", type: "string" }],
								isEnabled: () => selectedView() !== undefined,
								run: ({ label }) => {
									const id = selectedView();
									if (id && typeof label === "string") setViewLabel(ctx.store, id, label);
								},
							}),
						];
			const selectedTable = (): string | undefined => {
				for (const id of ctx.store.getSelection()) {
					if (isTable(ctx.store.getShape(id))) return id;
				}
				return undefined;
			};
			const selectedSeat = (): string | undefined => {
				for (const id of ctx.store.getSelection()) {
					if (isSeat(ctx.store.getShape(id))) return id;
				}
				return undefined;
			};
			const tableActions =
				opts.tables === false
					? []
					: [
							ctx.actions.register({
								id: "tabletop-table:add",
								requires: PERMISSIONS.pageEdit,
								label: "Add game table",
								group: "Tabletop",
								run: () => {
									// In the middle of the screen, behind everything (it is what things are put
									// on), with a player at each end facing the other. One command, so undo /
									// redo takes the players along.
									const area = screenViewRect(ctx.store.getViewport(), getScreenSize());
									const back = ctx.store.getShapesSorted().find((s) => !s.parentId)?.zIndex;
									const taken = listSeatShapes(ctx.store);
									const first = nextSeatLabel(taken, "Player");
									const second = nextSeatLabel([...taken, { meta: { label: first } }], "Player");
									const shapes = createTableWithSeats(
										{
											x: area.x + area.width / 2 - DEFAULT_TABLE_SIZE.width / 2,
											y: area.y + area.height / 2 - DEFAULT_TABLE_SIZE.height / 2,
											zIndex: zIndexBetween(null, back ?? null),
										},
										[first, second],
									);
									const [table] = shapes;
									if (!table) return;
									ctx.commands.execute(createAddShapesCommand(ctx.store, shapes));
									ctx.store.setSelection([table.id]);
								},
							}),
							ctx.actions.register({
								id: "tabletop-table:add-seat",
								requires: PERMISSIONS.pageEdit,
								label: "Add player",
								group: "Tabletop",
								isEnabled: () => selectedTable() !== undefined,
								run: () => {
									const id = selectedTable();
									if (!id) return;
									const at = roomiestSeatPlacement(ctx.store, id);
									if (!at) return;
									const seat = createSeatShape({
										...at,
										label: nextSeatLabel(listSeatShapes(ctx.store), "Player"),
										parentId: id,
									});
									ctx.commands.execute(createAddShapeCommand(ctx.store, seat));
								},
							}),
							ctx.actions.register({
								id: "tabletop-table:spread",
								requires: PERMISSIONS.pageEdit,
								label: "Spread players evenly",
								group: "Tabletop",
								isEnabled: () => selectedTable() !== undefined,
								run: () => {
									const id = selectedTable();
									if (!id) return;
									const updates = spreadSeatUpdates(ctx.store, id);
									if (updates.length > 0) {
										ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, updates));
									}
								},
							}),
							ctx.actions.register({
								id: "tabletop-table:form",
								requires: PERMISSIONS.pageEdit,
								label: "Table shape",
								group: "Tabletop",
								params: [
									{
										name: "form",
										type: "enum",
										// No default: confirming without a pick must not reset the form.
										options: TABLE_FORMS.map((value) => ({ value, label: FORM_LABELS[value] })),
									},
									{
										name: "sides",
										type: "number",
										min: MIN_TABLE_SIDES,
										max: MAX_TABLE_SIDES,
									},
								],
								isEnabled: () => selectedTable() !== undefined,
								run: ({ form, sides }) => {
									const id = selectedTable();
									if (id && TABLE_FORMS.includes(form as TableForm)) {
										setTableForm(
											ctx.store,
											id,
											form as TableForm,
											typeof sides === "number" ? sides : undefined,
										);
									}
								},
							}),
							ctx.actions.register({
								id: "tabletop-table:camera",
								requires: PERMISSIONS.pageEdit,
								label: "Table camera",
								group: "Tabletop",
								params: [
									{
										name: "camera",
										type: "enum",
										// No default: confirming without a pick must not reset the table's camera.
										options: VIEW_CAMERAS.map((value) => ({ value, label: CAMERA_LABELS[value] })),
									},
								],
								isEnabled: () => selectedTable() !== undefined,
								run: ({ camera }) => {
									const id = selectedTable();
									if (id && VIEW_CAMERAS.includes(camera as ViewCamera)) {
										setTableCamera(ctx.store, id, camera as ViewCamera);
									}
								},
							}),
							ctx.actions.register({
								id: "tabletop-seat:label",
								requires: PERMISSIONS.pageEdit,
								label: "Player name",
								group: "Tabletop",
								params: [{ name: "label", type: "string" }],
								isEnabled: () => selectedSeat() !== undefined,
								run: ({ label }) => {
									const id = selectedSeat();
									if (id && typeof label === "string") setSeatLabel(ctx.store, id, label);
								},
							}),
						];
			const offActions = [
				...viewActions,
				...tableActions,
				ctx.actions.register({
					id: "tabletop-zone:arrange",
					requires: PERMISSIONS.pageEdit,
					label: "Zone layout",
					group: "Tabletop",
					params: [
						{
							name: "arrange",
							type: "enum",
							options: ZONE_ARRANGES.map((value) => ({ value, label: ARRANGE_LABELS[value] })),
							default: "pile",
						},
					],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ arrange }) => {
						const id = selectedZone();
						if (id && ZONE_ARRANGES.includes(arrange as ZoneArrange)) {
							setZoneArrange(ctx.store, id, arrange as ZoneArrange);
						}
					},
				}),
				ctx.actions.register({
					id: "tabletop-zone:align",
					requires: PERMISSIONS.pageEdit,
					label: "Zone alignment",
					group: "Tabletop",
					params: [
						{
							name: "align",
							type: "enum",
							options: ZONE_ALIGNS.map((value) => ({ value, label: ALIGN_LABELS[value] })),
							default: "center",
						},
					],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ align }) => {
						const id = selectedZone();
						if (id && ZONE_ALIGNS.includes(align as ZoneAlign)) {
							setZoneAlign(ctx.store, id, align as ZoneAlign);
						}
					},
				}),
				ctx.actions.register({
					id: "tabletop-zone:face",
					requires: PERMISSIONS.pageEdit,
					label: "Turn dropped shapes",
					group: "Tabletop",
					params: [
						{
							name: "face",
							type: "enum",
							options: ZONE_FACES.map((value) => ({ value, label: FACE_LABELS[value] })),
							default: "keep",
						},
					],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ face }) => {
						const id = selectedZone();
						if (id && ZONE_FACES.includes(face as ZoneFace)) {
							setZoneFace(ctx.store, id, face as ZoneFace);
						}
					},
				}),
				ctx.actions.register({
					id: "tabletop-zone:label",
					requires: PERMISSIONS.pageEdit,
					label: "Zone label",
					group: "Tabletop",
					params: [{ name: "label", type: "string", default: "" }],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ label }) => {
						const id = selectedZone();
						if (id) setZoneLabel(ctx.store, id, String(label ?? ""));
					},
				}),
			];

			const unprovide = tabletopService.provide(ctx.services, createTabletopApi(ctx.store));

			return () => {
				offWatch();
				for (const off of offActions) off();
				unprovide();
				if (draw) ctx.store.deleteShape(draw.id);
				draw = null;
			};
		},
	};
}
