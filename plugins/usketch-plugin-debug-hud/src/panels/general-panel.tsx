import type {
	BoardStore,
	CommandRegistry,
	LayerManager,
	ShapeRegistry,
	ToolRegistry,
	Viewport,
} from "@edv4h/usketch-shared";
import { useCallback, useState, useSyncExternalStore } from "react";
import { FpsGraph } from "../components/fps-graph.js";
import type { FpsCounter } from "../fps-counter.js";
import type { PointerTracker } from "../pointer-tracker.js";
import {
	fmt,
	fpsColor,
	INLINE_INPUT,
	LABEL_STYLE,
	MINI_BUTTON,
	MINI_BUTTON_ACCENT,
	PANEL_BASE,
	SECTION_STYLE,
} from "../styles.js";
import type { SyncStatusTrackerLike } from "../sync-status-types.js";

interface GeneralPanelProps {
	store: BoardStore;
	fpsCounter: FpsCounter;
	pointerTracker: PointerTracker;
	commands: CommandRegistry;
	tools: ToolRegistry;
	layers: LayerManager;
	shapes: ShapeRegistry;
	syncStatus?: SyncStatusTrackerLike;
	viewport: Viewport;
	activeToolId: string;
}

const SYNC_STATE_COLORS: Record<string, string> = {
	loading: "#fbbf24",
	synced: "#4ade80",
	syncing: "#60a5fa",
	error: "#f87171",
};

const SYNC_STATE_LABELS: Record<string, string> = {
	loading: "Loading…",
	synced: "Synced",
	syncing: "Syncing…",
	error: "Error",
};

function formatTimestamp(ts: number | null): string {
	if (ts === null) return "—";
	const d = new Date(ts);
	return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function GeneralPanel({
	store,
	fpsCounter,
	pointerTracker,
	commands,
	tools,
	layers,
	shapes,
	syncStatus,
	viewport,
	activeToolId,
}: GeneralPanelProps) {
	const fps = useSyncExternalStore(
		useCallback((cb: () => void) => fpsCounter.subscribe(cb), [fpsCounter]),
		() => fpsCounter.getSnapshot(),
	);

	const pointer = useSyncExternalStore(
		useCallback((cb: () => void) => pointerTracker.subscribe(cb), [pointerTracker]),
		() => pointerTracker.getSnapshot(),
	);

	const defaultSyncSnapshot = {
		state: "loading" as const,
		shapeCount: 0,
		lastSyncedAt: null,
		error: null,
	};
	const syncSnapshot = useSyncExternalStore(
		useCallback(
			(cb: () => void) => (syncStatus ? syncStatus.subscribe(cb) : () => {}),
			[syncStatus],
		),
		() => syncStatus?.getSnapshot() ?? defaultSyncSnapshot,
	);

	const canUndo = commands.canUndo();
	const canRedo = commands.canRedo();
	const historySize = commands.getHistorySize();
	const historyCursor = commands.getCursor();

	const toolCount = tools.getAll().size;
	const layerCount = layers.getLayers().length;
	const shapeTypeCount = shapes.getAll().size;

	// Phase 2: viewport editing
	const [editingViewport, setEditingViewport] = useState(false);
	const [vpDraft, setVpDraft] = useState({ x: "", y: "", zoom: "" });

	const startEditViewport = () => {
		setVpDraft({ x: String(viewport.x), y: String(viewport.y), zoom: String(viewport.zoom) });
		setEditingViewport(true);
	};

	const commitViewport = () => {
		const x = Number.parseFloat(vpDraft.x);
		const y = Number.parseFloat(vpDraft.y);
		const zoom = Number.parseFloat(vpDraft.zoom);
		if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(zoom) && zoom > 0) {
			store.setViewport({ x, y, zoom });
		}
		setEditingViewport(false);
	};

	return (
		<div
			style={{
				...PANEL_BASE,
				position: "absolute",
				top: 8,
				right: 8,
				width: 220,
			}}
		>
			{/* FPS */}
			<div style={SECTION_STYLE}>
				<span style={{ color: fpsColor(fps), fontWeight: "bold" }}>{fps} FPS</span>
				<FpsGraph fpsCounter={fpsCounter} />
			</div>

			{/* Viewport */}
			<div style={SECTION_STYLE}>
				<div style={LABEL_STYLE}>
					Viewport{" "}
					{!editingViewport && (
						<button type="button" style={MINI_BUTTON} onClick={startEditViewport}>
							edit
						</button>
					)}
				</div>
				{editingViewport ? (
					<div style={{ display: "flex", gap: 3, alignItems: "center" }}>
						<input
							style={INLINE_INPUT}
							value={vpDraft.x}
							onChange={(e) => setVpDraft((d) => ({ ...d, x: e.target.value }))}
							onKeyDown={(e) => e.key === "Enter" && commitViewport()}
						/>
						<input
							style={INLINE_INPUT}
							value={vpDraft.y}
							onChange={(e) => setVpDraft((d) => ({ ...d, y: e.target.value }))}
							onKeyDown={(e) => e.key === "Enter" && commitViewport()}
						/>
						<input
							style={{ ...INLINE_INPUT, width: 36 }}
							value={vpDraft.zoom}
							onChange={(e) => setVpDraft((d) => ({ ...d, zoom: e.target.value }))}
							onKeyDown={(e) => e.key === "Enter" && commitViewport()}
						/>
						<button type="button" style={MINI_BUTTON_ACCENT} onClick={commitViewport}>
							OK
						</button>
					</div>
				) : (
					<div>
						x: {fmt(viewport.x)} y: {fmt(viewport.y)} zoom: {fmt(viewport.zoom)}
					</div>
				)}
			</div>

			{/* Active Tool */}
			<div style={SECTION_STYLE}>
				<div style={LABEL_STYLE}>Active Tool</div>
				<div>{activeToolId}</div>
			</div>

			{/* Pointer */}
			<div style={SECTION_STYLE}>
				<div style={LABEL_STYLE}>Pointer</div>
				<div>
					world: ({fmt(pointer.world.x)}, {fmt(pointer.world.y)})
				</div>
				<div>
					screen: ({fmt(pointer.screen.x)}, {fmt(pointer.screen.y)})
				</div>
			</div>

			{/* Undo/Redo */}
			<div style={SECTION_STYLE}>
				<div style={LABEL_STYLE}>
					History ({historyCursor + 1}/{historySize})
				</div>
				<div style={{ display: "flex", gap: 4 }}>
					<button
						type="button"
						style={{ ...MINI_BUTTON, opacity: canUndo ? 1 : 0.3 }}
						disabled={!canUndo}
						onClick={() => commands.undo()}
					>
						⟵ Undo
					</button>
					<button
						type="button"
						style={{ ...MINI_BUTTON, opacity: canRedo ? 1 : 0.3 }}
						disabled={!canRedo}
						onClick={() => commands.redo()}
					>
						Redo ⟶
					</button>
				</div>
			</div>

			{/* Sync Status */}
			<div style={SECTION_STYLE}>
				<div style={LABEL_STYLE}>Persistence (Yjs + IndexedDB)</div>
				<div style={{ display: "flex", alignItems: "center", gap: 5 }}>
					<span
						style={{
							display: "inline-block",
							width: 7,
							height: 7,
							borderRadius: "50%",
							background: SYNC_STATE_COLORS[syncSnapshot.state] ?? "#888",
						}}
					/>
					<span style={{ color: SYNC_STATE_COLORS[syncSnapshot.state] ?? "#888" }}>
						{SYNC_STATE_LABELS[syncSnapshot.state] ?? syncSnapshot.state}
					</span>
				</div>
				<div>
					Shapes: {syncSnapshot.shapeCount} · Last: {formatTimestamp(syncSnapshot.lastSyncedAt)}
				</div>
				{syncSnapshot.error && (
					<div style={{ color: "#f87171", fontSize: 10 }}>{syncSnapshot.error}</div>
				)}
			</div>

			{/* System Info */}
			<div>
				<div style={LABEL_STYLE}>System</div>
				<div>
					Tools: {toolCount} · Layers: {layerCount} · Shape types: {shapeTypeCount}
				</div>
			</div>
		</div>
	);
}
