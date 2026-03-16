import type {
	BoardStore,
	CommandRegistry,
	LayerManager,
	LayerRenderContext,
	ShapeRegistry,
	ToolRegistry,
} from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import type { EventLogger } from "./event-logger.js";
import type { FpsCounter } from "./fps-counter.js";
import { Minimap } from "./overlays/minimap.js";
import { ShapeBoundsOverlay } from "./overlays/shape-bounds-overlay.js";
import { EventsPanel } from "./panels/events-panel.js";
import { GeneralPanel } from "./panels/general-panel.js";
import { ShapesPanel } from "./panels/shapes-panel.js";
import type { PointerTracker } from "./pointer-tracker.js";
import { FONT_FAMILY, TEXT_MUTED } from "./styles.js";

interface DebugHudProps {
	store: BoardStore;
	fpsCounter: FpsCounter;
	eventLogger: EventLogger;
	pointerTracker: PointerTracker;
	commands: CommandRegistry;
	tools: ToolRegistry;
	layers: LayerManager;
	shapes: ShapeRegistry;
	ctx: LayerRenderContext;
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
	ctx,
}: DebugHudProps) {
	const [visible, setVisible] = useState(false);
	const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

	// Keyboard shortcut (backtick)
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (isEditableTarget(e.target)) return;
			if (e.key === "`" || e.code === "Backquote") {
				if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
					e.preventDefault();
					setVisible((v) => !v);
				}
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const { viewport, shapes: shapeMap, selection } = ctx;
	const activeToolId = store.getActiveToolId();

	const hoveredShape = hoveredShapeId ? shapeMap.get(hoveredShapeId) : undefined;

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
		<>
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
				viewport={viewport}
				activeToolId={activeToolId}
			/>

			{/* Left-center: Shapes Inspector */}
			<ShapesPanel
				store={store}
				commands={commands}
				shapes={shapeMap}
				selection={selection}
				onHoverShape={setHoveredShapeId}
			/>

			{/* Right-bottom: Event Log */}
			<EventsPanel eventLogger={eventLogger} />

			{/* Bottom-left: Minimap */}
			<Minimap shapes={shapeMap} viewport={viewport} selection={selection} />
		</>
	);
}
