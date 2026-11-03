import type {
	BoundingBox,
	Point,
	ResizeHandle,
	ShapeData,
	ShapeDefinition,
} from "@edv4h/usketch-shared";
import {
	type CSSProperties,
	type ReactElement,
	type ReactNode,
	useCallback,
	useSyncExternalStore,
} from "react";
import type { CroupierApi } from "./croupier-service.js";
import { isSeat, isTable, layoutSeats, makeTableShape, SEAT_SIZE } from "./table-ops.js";
import { CROUPIER_SEAT_TYPE, type SeatShape, type TableShape, type TableView } from "./types.js";

/** What a table renderer receives. `view` is always the local player's view. */
export interface TableRenderContext {
	shape: TableShape;
	view: TableView;
	api: CroupierApi;
}

/** What a seat renderer receives. */
export interface SeatRenderContext {
	seat: SeatShape;
	/** View of the seat's table (local player's point of view). */
	view: TableView;
	api: CroupierApi;
	isCurrent: boolean;
	isOnline: boolean;
}

export type TableRenderer = (ctx: TableRenderContext) => ReactElement;
export type SeatRenderer = (ctx: SeatRenderContext) => ReactElement;

export const TABLE_MIN_SIZE = { width: 480, height: 320 };

function useTableView(api: CroupierApi, tableId: string): TableView | undefined {
	const getSnapshot = useCallback(() => api.getView(tableId), [api, tableId]);
	return useSyncExternalStore(api.subscribe, getSnapshot, getSnapshot);
}

/**
 * Stops the canvas tools from treating a click on an in-shape control as a drag/select.
 * The table is a container, whose wrapper has `pointer-events: none` (so seats get
 * their clicks): give in-shape controls `pointerEvents: "auto"` as well.
 */
export const stopCanvas = {
	onPointerDown: (e: { stopPropagation(): void }) => e.stopPropagation(),
	onDoubleClick: (e: { stopPropagation(): void }) => e.stopPropagation(),
};

function TableHost({
	shape,
	api,
	render,
}: {
	shape: TableShape;
	api: CroupierApi;
	render: TableRenderer;
}) {
	const view = useTableView(api, shape.id);
	if (!view) return null;
	return render({ shape: view.table, view, api });
}

function SeatHost({
	seat,
	api,
	render,
}: {
	seat: SeatShape;
	api: CroupierApi;
	render: SeatRenderer;
}) {
	const view = useTableView(api, seat.parentId);
	if (!view) return null;
	const live = view.seats.find((s) => s.id === seat.id) ?? seat;
	return render({
		seat: live,
		view,
		api,
		isCurrent: view.currentPlayers.includes(live.meta.userId),
		isOnline: api.isOnline(live.meta.userId),
	});
}

// ── Built-in renderers (plain; hosts are expected to supply their own look) ──

const panel: CSSProperties = {
	width: "100%",
	height: "100%",
	boxSizing: "border-box",
	border: "2px solid #1e1e1e",
	borderRadius: 16,
	background: "#f7f3e8",
	fontFamily: "system-ui, sans-serif",
	color: "#1e1e1e",
	padding: 16,
	display: "flex",
	flexDirection: "column",
	gap: 8,
	overflow: "hidden",
	userSelect: "none",
};

const button: CSSProperties = {
	pointerEvents: "auto",
	border: "1px solid #1e1e1e",
	borderRadius: 8,
	background: "#ffffff",
	padding: "4px 10px",
	fontSize: 14,
	cursor: "pointer",
};

function Button({ children, onClick }: { children: ReactNode; onClick: () => void }) {
	return (
		<button
			type="button"
			style={button}
			{...stopCanvas}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
		>
			{children}
		</button>
	);
}

const PHASE_LABEL = { lobby: "参加受付中", playing: "プレイ中", finished: "終了" } as const;

/** Built-in table look: lobby controls, the current turn and the raw view. */
export const defaultRenderTable: TableRenderer = ({ shape, view, api }) => {
	const current = view.seats.find((s) => s.meta.userId === view.currentPlayers[0]);
	return (
		<div style={panel}>
			<div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
				<span>{view.definition?.label ?? shape.meta.game}</span>
				<span>{PHASE_LABEL[view.phase]}</span>
			</div>
			<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
				{view.canJoin && <Button onClick={() => api.join(shape.id)}>参加する</Button>}
				{view.phase === "lobby" && view.mySeat && (
					<Button onClick={() => api.leave(shape.id)}>抜ける</Button>
				)}
				{view.canStart && <Button onClick={() => api.start(shape.id)}>スタート</Button>}
				{view.isHost && view.phase === "playing" && current && !view.isMyTurn && (
					<Button onClick={() => void api.takeOver(shape.id)}>代わりに進める</Button>
				)}
				{view.isHost && view.phase !== "lobby" && (
					<Button onClick={() => api.reset(shape.id)}>ロビーに戻す</Button>
				)}
			</div>
			{view.phase === "playing" && (
				<div>{view.isMyTurn ? "あなたの番です" : `${current?.meta.name ?? "…"} さんの番`}</div>
			)}
			{view.isMyTurn && (
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					{view.allowedActions.flatMap((action) => {
						const choices = view.definition?.actionChoices
							? view.definition.actionChoices(action, view.gameView, api.me().userId)
							: [{ label: action }];
						return choices.map((choice) => (
							<Button
								key={`${action}:${choice.label}`}
								onClick={() => api.dispatch(shape.id, action, choice.payload)}
							>
								{choice.label}
							</Button>
						));
					})}
				</div>
			)}
			{view.gameView !== null && (
				<pre
					style={{
						flex: 1,
						// Leave the bottom row to the seats (see layoutSeats).
						margin: `0 0 ${SEAT_SIZE.height}px`,
						overflow: "auto",
						fontSize: 11,
						background: "#ffffff",
						pointerEvents: "auto",
					}}
				>
					{JSON.stringify(view.phase === "finished" ? view.result : view.gameView, null, 1)}
				</pre>
			)}
		</div>
	);
};

/** Built-in seat look: name, turn marker and connection state. */
export const defaultRenderSeat: SeatRenderer = ({ seat, view, isCurrent, isOnline }) => (
	<div
		style={{
			width: "100%",
			height: "100%",
			boxSizing: "border-box",
			border: `2px solid ${isCurrent ? "#e8590c" : "#1e1e1e"}`,
			borderRadius: 10,
			background: "#ffffff",
			fontFamily: "system-ui, sans-serif",
			fontSize: 13,
			padding: "4px 8px",
			opacity: isOnline ? 1 : 0.5,
			overflow: "hidden",
			whiteSpace: "nowrap",
			textOverflow: "ellipsis",
		}}
	>
		{view.table.meta.hostUserId === seat.meta.userId ? "★ " : ""}
		{seat.meta.name}
		{isCurrent ? " (手番)" : ""}
	</div>
);

// ── Shape definitions ──

const rectBounds = (data: ShapeData): BoundingBox => ({
	x: data.x,
	y: data.y,
	width: data.width,
	height: data.height,
});

const rectHit = (data: ShapeData, p: Point) =>
	p.x >= data.x && p.x <= data.x + data.width && p.y >= data.y && p.y <= data.y + data.height;

function resizeRect(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	if (handle.includes("e")) width += delta.x;
	if (handle.includes("s")) height += delta.y;
	if (handle.includes("w")) {
		x += delta.x;
		width -= delta.x;
	}
	if (handle.includes("n")) {
		y += delta.y;
		height -= delta.y;
	}
	const w = Math.max(TABLE_MIN_SIZE.width, width);
	const h = Math.max(TABLE_MIN_SIZE.height, height);
	// Keep the opposite edge fixed when clamping a west / north drag.
	if (handle.includes("w")) x += width - w;
	if (handle.includes("n")) y += height - h;
	return { ...data, x, y, width: w, height: h };
}

export interface TableShapeOptions {
	api: CroupierApi;
	renderTable?: TableRenderer;
	tableSize: { width: number; height: number };
	/** Default game of a table created by `createDefault` (shape registry / tools). */
	defaultGame: () => string | undefined;
}

export function tableShapeDefinition(opts: TableShapeOptions): ShapeDefinition {
	const render = opts.renderTable ?? defaultRenderTable;
	return {
		renderTarget: "html",
		render: (data) =>
			isTable(data) ? <TableHost shape={data} api={opts.api} render={render} /> : <></>,
		getBounds: rectBounds,
		hitTest: rectHit,
		resize: resizeRect,
		minSize: TABLE_MIN_SIZE,
		createDefault: ({ id, x, y }) =>
			makeTableShape(new Map(opts.api.games().map((g) => [g.id, g])), {
				id,
				x,
				y,
				game: opts.defaultGame() ?? "",
				host: opts.api.me(),
				size: opts.tableSize,
			}),
		// Seats are children: clicking one selects the table, and they follow it.
		container: {
			selectableChildren: false,
			autoAttach: false,
			// Only seats are laid out; any other child keeps where it is.
			layout: ({ container, children }) => layoutSeats(container, children.filter(isSeat)),
		},
	};
}

export interface SeatShapeOptions {
	api: CroupierApi;
	renderSeat?: SeatRenderer;
}

export function seatShapeDefinition(opts: SeatShapeOptions): ShapeDefinition {
	const render = opts.renderSeat ?? defaultRenderSeat;
	return {
		renderTarget: "html",
		// A malformed seat (no table / meta, e.g. from createDefault) renders nothing.
		render: (data) =>
			isSeat(data) ? <SeatHost seat={data} api={opts.api} render={render} /> : <></>,
		getBounds: rectBounds,
		hitTest: rectHit,
		resize: (data) => data,
		resizable: false,
		// Seats are only created by joining; a bare one has no table and is cleaned up.
		createDefault: ({ id, x, y }) => ({
			id,
			type: CROUPIER_SEAT_TYPE,
			x,
			y,
			width: 0,
			height: 0,
			style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 1, opacity: 1 },
		}),
	};
}
