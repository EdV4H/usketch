import type { BoardStore, LayerRenderContext } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { EventLogger } from "./event-logger.js";
import type { FpsCounter } from "./fps-counter.js";
import type { PointerTracker } from "./pointer-tracker.js";

interface DebugHudProps {
	store: BoardStore;
	fpsCounter: FpsCounter;
	eventLogger: EventLogger;
	pointerTracker: PointerTracker;
	ctx: LayerRenderContext;
}

const LABEL_STYLE: React.CSSProperties = {
	color: "#8b8b8b",
	fontSize: 10,
	marginBottom: 2,
};

const SECTION_STYLE: React.CSSProperties = {
	marginBottom: 6,
};

const SCROLLABLE_STYLE: React.CSSProperties = {
	maxHeight: 160,
	overflowY: "auto",
	pointerEvents: "auto",
	fontSize: 10,
	lineHeight: "14px",
};

function fmt(n: number): string {
	return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function shortId(id: string): string {
	return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function DebugHud({ store, fpsCounter, eventLogger, pointerTracker, ctx }: DebugHudProps) {
	const [visible, setVisible] = useState(false);

	// Keyboard shortcut (backtick) — skip when focus is on editable elements
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

	const fps = useSyncExternalStore(
		useCallback((cb: () => void) => fpsCounter.subscribe(cb), [fpsCounter]),
		() => fpsCounter.getSnapshot(),
	);

	const events = useSyncExternalStore(
		useCallback((cb: () => void) => eventLogger.subscribe(cb), [eventLogger]),
		() => eventLogger.getSnapshot(),
	);

	const pointer = useSyncExternalStore(
		useCallback((cb: () => void) => pointerTracker.subscribe(cb), [pointerTracker]),
		() => pointerTracker.getSnapshot(),
	);

	const { viewport, shapes, selection } = ctx;
	const activeToolId = store.getActiveToolId();
	const shapeEntries = Array.from(shapes.values());

	// Toggle button (always visible)
	const toggleButton = (
		<button
			type="button"
			onClick={() => setVisible((v) => !v)}
			style={{
				position: "absolute",
				top: 8,
				right: 8,
				width: 28,
				height: 28,
				border: "none",
				borderRadius: 6,
				background: visible ? "rgba(99, 102, 241, 0.8)" : "rgba(0, 0, 0, 0.5)",
				color: "#e0e0e0",
				fontSize: 14,
				fontFamily: "monospace",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				pointerEvents: "auto",
				backdropFilter: "blur(4px)",
				lineHeight: 1,
			}}
			title="Toggle Debug HUD (`)"
		>
			D
		</button>
	);

	if (!visible) {
		return toggleButton;
	}

	return (
		<>
			{toggleButton}
			<div
				style={{
					position: "absolute",
					top: 44,
					right: 8,
					width: 260,
					padding: 10,
					background: "rgba(0, 0, 0, 0.82)",
					color: "#e0e0e0",
					fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
					fontSize: 11,
					lineHeight: "16px",
					borderRadius: 8,
					backdropFilter: "blur(8px)",
					userSelect: "none",
				}}
			>
				{/* FPS */}
				<div style={SECTION_STYLE}>
					<span style={{ color: fps >= 50 ? "#4ade80" : fps >= 30 ? "#fbbf24" : "#f87171" }}>
						{fps} FPS
					</span>
				</div>

				{/* Viewport */}
				<div style={SECTION_STYLE}>
					<div style={LABEL_STYLE}>Viewport</div>
					<div>
						x: {fmt(viewport.x)} y: {fmt(viewport.y)} zoom: {fmt(viewport.zoom)}
					</div>
				</div>

				{/* Shapes */}
				<div style={SECTION_STYLE}>
					<div style={LABEL_STYLE}>Shapes</div>
					<div>{shapes.size}</div>
				</div>

				{/* Selection */}
				<div style={SECTION_STYLE}>
					<div style={LABEL_STYLE}>Selection</div>
					<div>
						{selection.size === 0
							? "none"
							: `${selection.size}: ${Array.from(selection).map(shortId).join(", ")}`}
					</div>
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
						world: ({fmt(pointer.world.x)}, {fmt(pointer.world.y)}) screen: ({fmt(pointer.screen.x)}
						, {fmt(pointer.screen.y)})
					</div>
				</div>

				{/* Shape List */}
				<div style={SECTION_STYLE}>
					<div style={LABEL_STYLE}>Shape List</div>
					<div style={SCROLLABLE_STYLE}>
						{shapeEntries.length === 0 ? (
							<div style={{ color: "#6b7280" }}>No shapes</div>
						) : (
							shapeEntries.map((s) => (
								<div
									key={s.id}
									style={{
										padding: "1px 4px",
										borderRadius: 3,
										background: selection.has(s.id) ? "rgba(99, 102, 241, 0.3)" : "transparent",
									}}
								>
									{shortId(s.id)} {s.type} ({fmt(s.x)}, {fmt(s.y)}) {fmt(s.width)}
									&times;{fmt(s.height)}
								</div>
							))
						)}
					</div>
				</div>

				{/* Event Log */}
				<div>
					<div style={LABEL_STYLE}>Event Log</div>
					<div style={SCROLLABLE_STYLE}>
						{events.length === 0 ? (
							<div style={{ color: "#6b7280" }}>No events</div>
						) : (
							[...events].reverse().map((entry, i) => (
								<div key={`${entry.timestamp}-${i}`} style={{ color: "#a0a0a0" }}>
									<span style={{ color: "#6b7280" }}>
										{new Date(entry.timestamp).toLocaleTimeString()}{" "}
									</span>
									{entry.event}
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</>
	);
}
