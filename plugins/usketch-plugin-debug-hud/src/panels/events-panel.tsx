import { useCallback, useState, useSyncExternalStore } from "react";
import type { EventLogger } from "../event-logger.js";
import { LABEL_STYLE, MINI_BUTTON, PANEL_BASE, SCROLLABLE_STYLE, TEXT_MUTED } from "../styles.js";

interface EventsPanelProps {
	eventLogger: EventLogger;
}

export function EventsPanel({ eventLogger }: EventsPanelProps) {
	const [filter, setFilter] = useState("");

	const events = useSyncExternalStore(
		useCallback((cb: () => void) => eventLogger.subscribe(cb), [eventLogger]),
		() => eventLogger.getSnapshot(),
	);

	const filtered = filter
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
						<div key={`${entry.timestamp}-${i}`} style={{ color: "#a0a0a0" }}>
							<span style={{ color: TEXT_MUTED }}>
								{new Date(entry.timestamp).toLocaleTimeString()}{" "}
							</span>
							{entry.event}
						</div>
					))
				)}
			</div>
		</div>
	);
}
