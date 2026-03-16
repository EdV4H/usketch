import { useCallback, useState, useSyncExternalStore } from "react";
import type { EventLogEntry, EventLogger } from "../event-logger.js";
import { LABEL_STYLE, MINI_BUTTON, PANEL_BASE, SCROLLABLE_STYLE, TEXT_MUTED } from "../styles.js";

interface EventsPanelProps {
	eventLogger: EventLogger;
}

const EVENT_COLORS: Record<string, string> = {
	// canvas events — each action gets its own shade
	"canvas:pointerdown": "#3b82f6", // blue
	"canvas:pointerup": "#60a5fa", // light blue
	"canvas:pointermove": "#93c5fd", // lighter blue
	"canvas:wheel": "#2563eb", // dark blue
	"canvas:middle-down": "#1d4ed8", // darker blue
	// shape events
	shape: "#4ade80", // green
	// tool events
	tool: "#fbbf24", // yellow
	// selection events
	selection: "#c084fc", // purple
	// viewport events
	viewport: "#f472b6", // pink
	// command events
	command: "#fb923c", // orange
};

const DEFAULT_EVENT_COLOR = "#a0a0a0";

function eventColor(event: string): string {
	// Try exact match first, then prefix
	return EVENT_COLORS[event] ?? EVENT_COLORS[event.split(":")[0]] ?? DEFAULT_EVENT_COLOR;
}

export function EventsPanel({ eventLogger }: EventsPanelProps) {
	const [filter, setFilter] = useState("");

	const events = useSyncExternalStore(
		useCallback((cb: () => void) => eventLogger.subscribe(cb), [eventLogger]),
		() => eventLogger.getSnapshot(),
	);

	const filtered: readonly EventLogEntry[] = filter
		? events.filter((e) => e.event.toLowerCase().includes(filter.toLowerCase()))
		: events;

	return (
		<div
			style={{
				...PANEL_BASE,
				position: "absolute",
				bottom: 8,
				right: 8,
				width: 280,
				height: 240,
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				style={{
					...LABEL_STYLE,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<span>Event Log ({filtered.length})</span>
				<button type="button" style={MINI_BUTTON} onClick={() => eventLogger.clear()}>
					Clear
				</button>
			</div>
			<input
				type="text"
				placeholder="Filter events..."
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				style={{
					background: "rgba(255, 255, 255, 0.08)",
					border: "1px solid rgba(255, 255, 255, 0.15)",
					borderRadius: 3,
					color: "#e0e0e0",
					fontFamily: "'SF Mono', monospace",
					fontSize: 10,
					padding: "3px 6px",
					outline: "none",
					marginBottom: 4,
				}}
			/>
			<div style={{ ...SCROLLABLE_STYLE, flexGrow: 1 }}>
				{filtered.length === 0 ? (
					<div style={{ color: TEXT_MUTED }}>No events</div>
				) : (
					[...filtered].reverse().map((entry, i) => (
						<div key={`${entry.timestamp}-${i}`} style={{ color: eventColor(entry.event) }}>
							<span style={{ color: TEXT_MUTED }}>
								{new Date(entry.timestamp).toLocaleTimeString()}{" "}
							</span>
							{entry.event}
							{entry.count > 1 && <span style={{ color: TEXT_MUTED }}> ({entry.count})</span>}
						</div>
					))
				)}
			</div>
		</div>
	);
}
