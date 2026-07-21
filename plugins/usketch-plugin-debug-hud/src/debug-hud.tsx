import type {
	ActionRegistry,
	BoardStore,
	CommandRegistry,
	EventBus,
	LayerManager,
	LayerRenderContext,
	ShapeRegistry,
	ToolRegistry,
} from "@edv4h/usketch-shared";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BoardMetaTrackerLike } from "./board-meta-types.js";
import type { EventLogger } from "./event-logger.js";
import type { FpsCounter } from "./fps-counter.js";
import { Minimap } from "./overlays/minimap.js";
import { ShapeBoundsOverlay } from "./overlays/shape-bounds-overlay.js";
import {
	CONTROLS_DOCK_COLLAPSED,
	CONTROLS_DOCK_WIDTH,
	ControlsPanel,
} from "./panels/controls-panel.js";
import { EventsPanel } from "./panels/events-panel.js";
import { GeneralPanel } from "./panels/general-panel.js";
import { MembersPanel } from "./panels/members-panel.js";
import { ShapesPanel } from "./panels/shapes-panel.js";
import type { PointerTracker } from "./pointer-tracker.js";
import type { PresenceTrackerLike } from "./presence-types.js";
import { FONT_FAMILY, TEXT_MUTED } from "./styles.js";
import type { SyncStatusTrackerLike } from "./sync-status-types.js";
import type { VisibilityStore } from "./visibility-store.js";

interface DebugHudProps {
	store: BoardStore;
	fpsCounter: FpsCounter;
	eventLogger: EventLogger;
	pointerTracker: PointerTracker;
	commands: CommandRegistry;
	tools: ToolRegistry;
	layers: LayerManager;
	shapes: ShapeRegistry;
	actions: ActionRegistry;
	syncStatus?: SyncStatusTrackerLike;
	boardMeta?: BoardMetaTrackerLike;
	presence?: PresenceTrackerLike;
	events: EventBus;
	ctx: LayerRenderContext;
	visibility: VisibilityStore;
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function DebugHud({
	store,
	fpsCounter,
	eventLogger,
	pointerTracker,
	commands,
	tools,
	layers,
	shapes,
	actions,
	syncStatus,
	boardMeta,
	presence,
	events,
	ctx,
	visibility,
}: DebugHudProps) {
	const subscribeVisibility = useCallback(
		(cb: () => void) => visibility.subscribe(cb),
		[visibility],
	);
	const getVisibility = useCallback(() => visibility.get(), [visibility]);
	const visible = useSyncExternalStore(subscribeVisibility, getVisibility, getVisibility);
	const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
	const [controlsCollapsed, setControlsCollapsed] = useState(false);
	// Left offset for the Shapes panel / Minimap so they clear the Controls dock.
	const leftOffset = 8 + (controlsCollapsed ? CONTROLS_DOCK_COLLAPSED : CONTROLS_DOCK_WIDTH) + 8;

	// Keyboard shortcut (backtick)
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (isEditableTarget(e.target)) return;
			if (e.key === "`" || e.code === "Backquote") {
				if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
					e.preventDefault();
					visibility.set(!visibility.get());
				}
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [visibility]);

	const { viewport, shapes: shapeMap, selection } = ctx;
	const activeToolId = store.getActiveToolId();

	// Subscribe to sync status so the Shapes panel can highlight unconfirmed
	// shape IDs. Snapshot is undefined when no sync layer is loaded. Stable
	// callbacks avoid resubscribe churn during unrelated re-renders (HUD
	// re-renders frequently due to FPS / pointer / event log updates).
	const subscribeSync = useCallback(
		(cb: () => void) => syncStatus?.subscribe(cb) ?? (() => {}),
		[syncStatus],
	);
	const getSyncSnapshot = useCallback(() => syncStatus?.getSnapshot(), [syncStatus]);
	const syncSnapshot = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
	const unconfirmedShapeIdSet = useMemo(
		() => new Set(syncSnapshot?.unconfirmedShapeIds ?? []),
		[syncSnapshot?.unconfirmedShapeIds],
	);

	const hoveredShape = hoveredShapeId ? shapeMap.get(hoveredShapeId) : undefined;

	// Canvas は自身のコンテナに native な wheel リスナ(passive:false)を張り、
	// HUD パネル上のスクロールまで拾って zoom/pan してしまう。React の onWheel
	// stopPropagation は Canvas コンテナより後(React root)で発火するため間に合わ
	// ない。パネル群を包む本要素に native wheel リスナを張り、パネル由来の wheel
	// が Canvas コンテナへバブリングする前に止める（パネル自身のスクロールは通す
	// ので stopPropagation のみ、preventDefault はしない）。空き領域の wheel は
	// pointerEvents:none によりこの要素を経由せず Canvas に直接届くため無影響。
	const wheelGuardRef = useRef<HTMLDivElement>(null);
	// visible はラッパーのマウント/アンマウントを切り替えるため、ref 再取得の
	// トリガーとして依存に含める（body 内で直接参照しないので biome へ明示）。
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-attach on visibility toggle
	useEffect(() => {
		const el = wheelGuardRef.current;
		if (!el) return;
		const stop = (e: WheelEvent) => e.stopPropagation();
		el.addEventListener("wheel", stop, { passive: false });
		return () => el.removeEventListener("wheel", stop);
	}, [visible]);

	// Shortcut hint — bottom-center (always visible)
	const hint = (
		<div
			style={{
				position: "absolute",
				bottom: 8,
				left: "50%",
				transform: "translateX(-50%)",
				color: TEXT_MUTED,
				fontSize: 10,
				fontFamily: FONT_FAMILY,
				pointerEvents: "none",
			}}
		>
			Debug HUD · press <kbd style={{ color: "#e0e0e0" }}>`</kbd> to {visible ? "close" : "open"}
		</div>
	);

	if (!visible) {
		return hint;
	}

	return (
		<div ref={wheelGuardRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{hint}

			{/* Bounding box overlay (behind panels, no pointer events) */}
			<ShapeBoundsOverlay shape={hoveredShape} store={store} />

			{/* Right-top: General Panel */}
			<GeneralPanel
				store={store}
				fpsCounter={fpsCounter}
				pointerTracker={pointerTracker}
				commands={commands}
				tools={tools}
				layers={layers}
				shapes={shapes}
				syncStatus={syncStatus}
				boardMeta={boardMeta}
				events={events}
				viewport={viewport}
				activeToolId={activeToolId}
			/>

			{/* Right-top (left of General): online members (旧 PresencePill) */}
			<MembersPanel presence={presence} />

			{/* Left dock: universal control panel (tools + actions + shapes + event console + style) */}
			<ControlsPanel
				store={store}
				tools={tools}
				actions={actions}
				events={events}
				activeToolId={activeToolId}
				collapsed={controlsCollapsed}
				onToggleCollapsed={() => setControlsCollapsed((c) => !c)}
				shapesSection={
					<ShapesPanel
						store={store}
						commands={commands}
						shapes={shapeMap}
						selection={selection}
						registry={shapes}
						onHoverShape={setHoveredShapeId}
						unconfirmedShapeIds={unconfirmedShapeIdSet}
						docked
					/>
				}
			/>

			{/* Right-bottom: Event Log */}
			<EventsPanel eventLogger={eventLogger} />

			{/* Bottom-left (right of the dock): Minimap + zoom controls */}
			<Minimap
				store={store}
				shapes={shapeMap}
				viewport={viewport}
				selection={selection}
				offsetLeft={leftOffset}
			/>
		</div>
	);
}
