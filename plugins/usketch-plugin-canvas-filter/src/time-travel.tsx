import type { ShapeData } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useState } from "react";

interface SnapshotEntry {
	timestamp: number;
	shapeCount: number;
}

function formatDate(ts: number): string {
	const d = new Date(ts);
	return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimeTravelPanel({
	apiBaseUrl,
	onEnter,
	onExit,
}: {
	apiBaseUrl: string;
	onEnter: (shapes: Map<string, ShapeData>, timestamp: number) => void;
	onExit: () => void;
}) {
	const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [activeTs, setActiveTs] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		fetch(`${apiBaseUrl}/snapshots`)
			.then((r) => r.json())
			.then((data: { snapshots: SnapshotEntry[] }) => {
				if (!cancelled) {
					setSnapshots(data.snapshots ?? []);
					setLoading(false);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setError("Failed to load snapshots");
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [apiBaseUrl]);

	const handleSelect = useCallback(
		async (ts: number) => {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch(`${apiBaseUrl}/snapshots/${ts}`);
				const data = (await res.json()) as {
					timestamp: number;
					shapes: Record<string, unknown>[];
				};
				const shapesMap = new Map<string, ShapeData>();
				for (const s of data.shapes) {
					if (typeof s.id === "string") {
						shapesMap.set(s.id, s as unknown as ShapeData);
					}
				}
				setActiveTs(ts);
				onEnter(shapesMap, ts);
			} catch {
				setError("Failed to load snapshot");
			} finally {
				setLoading(false);
			}
		},
		[apiBaseUrl, onEnter],
	);

	const handleExit = useCallback(() => {
		setActiveTs(null);
		onExit();
	}, [onExit]);

	const handleCreateSnapshot = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`${apiBaseUrl}/snapshot`, { method: "POST" });
			const data = (await res.json()) as SnapshotEntry;
			setSnapshots((prev) => [...prev, data]);
		} catch {
			setError("Failed to create snapshot");
		} finally {
			setLoading(false);
		}
	}, [apiBaseUrl]);

	return (
		<div
			style={{
				padding: 12,
				fontFamily: "system-ui, sans-serif",
				fontSize: 13,
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 12,
				}}
			>
				<h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Time Travel</h3>
				<button
					type="button"
					onClick={handleCreateSnapshot}
					disabled={loading}
					style={{
						padding: "4px 8px",
						fontSize: 12,
						border: "1px solid #d1d5db",
						borderRadius: 6,
						background: "#fff",
						cursor: loading ? "not-allowed" : "pointer",
					}}
				>
					Save snapshot
				</button>
			</div>

			{activeTs != null && (
				<div
					style={{
						padding: "8px 12px",
						background: "#fef3c7",
						border: "1px solid #f59e0b",
						borderRadius: 8,
						marginBottom: 12,
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<span style={{ fontSize: 12 }}>Viewing: {formatDate(activeTs)}</span>
					<button
						type="button"
						onClick={handleExit}
						style={{
							padding: "3px 8px",
							fontSize: 11,
							border: "1px solid #f59e0b",
							borderRadius: 4,
							background: "#fff",
							cursor: "pointer",
						}}
					>
						Return to present
					</button>
				</div>
			)}

			{error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}

			{loading && <div style={{ color: "#6b7280" }}>Loading...</div>}

			{!loading && snapshots.length === 0 && (
				<div style={{ color: "#6b7280" }}>
					No snapshots yet. Snapshots are created automatically every hour.
				</div>
			)}

			<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
				{[...snapshots].reverse().map((entry) => (
					<li
						key={entry.timestamp}
						style={{
							padding: "8px 10px",
							borderRadius: 6,
							marginBottom: 4,
							cursor: "pointer",
							background: entry.timestamp === activeTs ? "#e0e7ff" : "transparent",
							border: entry.timestamp === activeTs ? "1px solid #818cf8" : "1px solid transparent",
						}}
						onPointerDown={() => handleSelect(entry.timestamp)}
					>
						<div style={{ fontWeight: 500 }}>{formatDate(entry.timestamp)}</div>
						<div style={{ fontSize: 11, color: "#6b7280" }}>{entry.shapeCount} shapes</div>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Banner shown while in time-travel mode */
export function TimeTravelBanner({ timestamp, onExit }: { timestamp: number; onExit: () => void }) {
	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				zIndex: 9997,
				padding: "8px 16px",
				background: "linear-gradient(135deg, #fef3c7, #fde68a)",
				borderBottom: "2px solid #f59e0b",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				gap: 12,
				fontFamily: "system-ui, sans-serif",
				fontSize: 13,
				fontWeight: 500,
			}}
		>
			<span>Time Travel — {formatDate(timestamp)}</span>
			<button
				type="button"
				onClick={onExit}
				style={{
					padding: "4px 12px",
					fontSize: 12,
					border: "1px solid #d97706",
					borderRadius: 6,
					background: "#fff",
					cursor: "pointer",
					fontWeight: 600,
				}}
			>
				Return to present
			</button>
		</div>
	);
}
