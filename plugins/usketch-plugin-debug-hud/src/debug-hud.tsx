import type {
	ActionRegistry,
	BoardStore,
	CommandRegistry,
	EventBus,
	HudRegistry,
	LayerManager,
	LayerRenderContext,
	PermissionProvider,
	PluginInfoRegistry,
	ShapeRegistry,
	ToolRegistry,
} from "@edv4h/usketch-shared";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import type { DockPrefsStore } from "./dock-prefs-store.js";
import type { EventLogger } from "./event-logger.js";
import type { FpsCounter } from "./fps-counter.js";
import { openSidePanel } from "./hud-slots.js";
import { Minimap } from "./overlays/minimap.js";
import { ShapeBoundsOverlay } from "./overlays/shape-bounds-overlay.js";
import {
	CONTROLS_DOCK_COLLAPSED,
	CONTROLS_DOCK_WIDTH,
	ControlsPanel,
} from "./panels/controls-panel.js";
import { EventsPanel } from "./panels/events-panel.js";
import { GENERAL_PANEL_WIDTH, GeneralPanel } from "./panels/general-panel.js";
import { ShapesPanel } from "./panels/shapes-panel.js";
import { SIDE_PANEL_WIDTH, SidePanelHost } from "./panels/side-panel-host.js";
import { StatusBar } from "./panels/status-bar.js";
import type { PointerTracker } from "./pointer-tracker.js";
import { FONT_FAMILY, TEXT_MUTED } from "./styles.js";
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
	hud: HudRegistry;
	pluginInfo: PluginInfoRegistry;
	events: EventBus;
	ctx: LayerRenderContext;
	visibility: VisibilityStore;
	dockPrefs: DockPrefsStore;
	/** What the viewer may do; the dock hides controls whose `requires` it denies. */
	permissions?: PermissionProvider;
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
	hud,
	pluginInfo,
	events,
	ctx,
	visibility,
	dockPrefs,
	permissions,
}: DebugHudProps) {
	const subscribeVisibility = useCallback(
		(cb: () => void) => visibility.subscribe(cb),
		[visibility],
	);
	const getVisibility = useCallback(() => visibility.get(), [visibility]);
	const visible = useSyncExternalStore(subscribeVisibility, getVisibility, getVisibility);
	const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
	const [controlsCollapsed, setControlsCollapsed] = useState(false);
	// Re-render when a side panel opens / closes (the right column moves aside for it).
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => hud.subscribe(bump), [hud]);
	useEffect(() => permissions?.subscribe(bump), [permissions]);
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

	// The side panel and the status bar stay on screen while the rest of the HUD is closed.
	const sideOpen = openSidePanel(hud, permissions) !== null;
	const rightColumn = 8 + (sideOpen ? SIDE_PANEL_WIDTH + 8 : 0);
	// The status bar keeps to the space the open panels leave free at the top.
	const statusLeft = visible ? leftOffset : 8;
	const statusRight = rightColumn + (visible ? GENERAL_PANEL_WIDTH + 8 : 0);
	const persistent = (
		<>
			<StatusBar hud={hud} permissions={permissions} left={statusLeft} right={statusRight} />
			<SidePanelHost hud={hud} permissions={permissions} />
		</>
	);

	if (!visible) {
		return (
			<div ref={wheelGuardRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
				{hint}
				{persistent}
			</div>
		);
	}

	return (
		<div ref={wheelGuardRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{hint}
			{persistent}

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
				viewport={viewport}
				activeToolId={activeToolId}
				right={rightColumn}
			/>

			{/* Left dock: universal control panel (tools + actions + shapes + event console + style) */}
			<ControlsPanel
				store={store}
				tools={tools}
				actions={actions}
				hud={hud}
				plugins={pluginInfo}
				events={events}
				activeToolId={activeToolId}
				collapsed={controlsCollapsed}
				onToggleCollapsed={() => setControlsCollapsed((c) => !c)}
				prefs={dockPrefs}
				permissions={permissions}
				shapesSection={
					<ShapesPanel
						store={store}
						commands={commands}
						shapes={shapeMap}
						selection={selection}
						registry={shapes}
						onHoverShape={setHoveredShapeId}
						docked
					/>
				}
			/>

			{/* Right-bottom: Event Log */}
			<EventsPanel eventLogger={eventLogger} right={rightColumn} />

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
