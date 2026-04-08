import type { BoardStore } from "@edv4h/usketch-shared";
import { useCallback, useRef, useState } from "react";
import { BenchmarkCanvas, clearShapes, loadShapes } from "./benchmark/benchmark-canvas.js";
import { type PerfStats, PerfTracker } from "./benchmark/perf-tracker.js";
import { generateShapes, type ShapeMix } from "./benchmark/shape-generator.js";

const SHAPE_COUNTS = [100, 1_000, 5_000, 10_000, 42_000];
const TEST_DURATION_MS = 5_000;
const PAN_SPEED = 3;
const WARMUP_FRAMES = 10;

interface BenchResult {
	off: PerfStats;
	on: PerfStats;
	shapeCount: number;
	shapeMix: ShapeMix;
}

export function BenchmarkPage() {
	const [shapeCount, setShapeCount] = useState(1_000);
	const [shapeMix, setShapeMix] = useState<ShapeMix>("mixed");
	const [running, setRunning] = useState(false);
	const [results, setResults] = useState<BenchResult[]>([]);
	const [liveOff, setLiveOff] = useState({ fps: 0, frameTime: 0 });
	const [liveOn, setLiveOn] = useState({ fps: 0, frameTime: 0 });

	const offStoreRef = useRef<BoardStore | null>(null);
	const onStoreRef = useRef<BoardStore | null>(null);
	const rafRef = useRef(0);

	const onOffReady = useCallback((store: BoardStore) => {
		offStoreRef.current = store;
	}, []);
	const onOnReady = useCallback((store: BoardStore) => {
		onStoreRef.current = store;
	}, []);

	function startBenchmark() {
		const offStore = offStoreRef.current;
		const onStore = onStoreRef.current;
		if (!offStore || !onStore) return;

		clearShapes(offStore);
		clearShapes(onStore);

		const shapes = generateShapes(shapeCount, shapeMix);
		loadShapes(offStore, shapes);
		loadShapes(onStore, shapes);

		offStore.setViewport({ x: 0, y: 0, zoom: 1 });
		onStore.setViewport({ x: 0, y: 0, zoom: 1 });

		setRunning(true);

		const offTracker = new PerfTracker();
		const onTracker = new PerfTracker();
		let lastTime = performance.now();
		let elapsed = 0;
		let frameIndex = 0;

		function frame() {
			const now = performance.now();
			const dt = now - lastTime;
			lastTime = now;
			elapsed += dt;
			frameIndex++;

			if (frameIndex > WARMUP_FRAMES) {
				offTracker.recordFrame(dt);
				onTracker.recordFrame(dt);
			}

			offStore?.panBy(PAN_SPEED, 0);
			onStore?.panBy(PAN_SPEED, 0);

			if (frameIndex % 5 === 0) {
				setLiveOff({ fps: offTracker.getLiveFps(), frameTime: offTracker.getLiveFrameTime() });
				setLiveOn({ fps: onTracker.getLiveFps(), frameTime: onTracker.getLiveFrameTime() });
			}

			if (elapsed < TEST_DURATION_MS) {
				rafRef.current = requestAnimationFrame(frame);
			} else {
				setRunning(false);
				setResults((prev) => [
					...prev,
					{
						off: offTracker.getStats(),
						on: onTracker.getStats(),
						shapeCount,
						shapeMix,
					},
				]);
			}
		}

		rafRef.current = requestAnimationFrame(frame);
	}

	function clearResults() {
		setResults([]);
	}

	return (
		<div style={rootStyle}>
			{/* Header */}
			<div style={headerStyle}>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>uSketch Benchmark</h1>
					<span style={{ fontSize: 12, color: "#888" }}>LOD off vs LOD on</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
					<label>
						Shapes:{" "}
						<select
							value={shapeCount}
							onChange={(e) => setShapeCount(Number(e.target.value))}
							disabled={running}
							style={selectStyle}
						>
							{SHAPE_COUNTS.map((n) => (
								<option key={n} value={n}>
									{n.toLocaleString()}
								</option>
							))}
						</select>
					</label>
					<label>
						Mix:{" "}
						<select
							value={shapeMix}
							onChange={(e) => setShapeMix(e.target.value as ShapeMix)}
							disabled={running}
							style={selectStyle}
						>
							<option value="rect">Rect only</option>
							<option value="mixed">Mixed</option>
						</select>
					</label>
					<button
						type="button"
						onClick={startBenchmark}
						disabled={running}
						style={{
							...buttonStyle,
							background: running ? "#333" : "#3b82f6",
							cursor: running ? "not-allowed" : "pointer",
						}}
					>
						{running ? "Running..." : "Start Benchmark"}
					</button>
				</div>
			</div>

			{/* Canvas panels */}
			<div style={{ flex: 1, display: "flex", minHeight: 0 }}>
				{/* LOD off panel */}
				<div style={{ ...panelStyle, borderRight: "1px solid #333" }}>
					<div style={panelHeaderStyle}>
						<span style={{ fontWeight: 600 }}>LOD off (DOM only)</span>
						<span style={liveStatStyle}>
							FPS: {liveOff.fps} · Frame: {liveOff.frameTime}ms
						</span>
					</div>
					<div style={{ flex: 1, position: "relative" }}>
						<BenchmarkCanvas mode="lod-off" onReady={onOffReady} />
					</div>
				</div>

				{/* LOD on panel */}
				<div style={panelStyle}>
					<div style={panelHeaderStyle}>
						<span style={{ fontWeight: 600 }}>LOD on (GPU + simplified DOM)</span>
						<span style={liveStatStyle}>
							FPS: {liveOn.fps} · Frame: {liveOn.frameTime}ms
						</span>
					</div>
					<div style={{ flex: 1, position: "relative" }}>
						<BenchmarkCanvas mode="lod-on" onReady={onOnReady} />
					</div>
				</div>
			</div>

			{/* Results */}
			{results.length > 0 && (
				<div style={resultsStyle}>
					<div style={resultHeaderStyle}>
						<span style={{ fontSize: 14, fontWeight: 600 }}>Results</span>
						<button
							type="button"
							onClick={clearResults}
							style={{ ...buttonStyle, background: "#555", fontSize: 11 }}
						>
							Clear
						</button>
					</div>
					<table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
						<thead>
							<tr style={{ color: "#888", textAlign: "left" }}>
								<th style={thStyle}>Shapes</th>
								<th style={thStyle}>Mix</th>
								<th style={thStyle}>Off FPS</th>
								<th style={thStyle}>Off Frame</th>
								<th style={thStyle}>Off P99</th>
								<th style={thStyle}>On FPS</th>
								<th style={thStyle}>On Frame</th>
								<th style={thStyle}>On P99</th>
								<th style={thStyle}>Speedup</th>
							</tr>
						</thead>
						<tbody>
							{results.map((r, i) => {
								const speedup = r.off.avgFrameTime > 0 ? r.off.avgFrameTime / r.on.avgFrameTime : 0;
								return (
									<tr
										key={`${r.shapeCount}-${r.shapeMix}-${i}`}
										style={{ borderTop: "1px solid #333" }}
									>
										<td style={tdStyle}>{r.shapeCount.toLocaleString()}</td>
										<td style={tdStyle}>{r.shapeMix}</td>
										<td style={tdStyle}>{r.off.avgFps}</td>
										<td style={tdStyle}>{r.off.avgFrameTime}ms</td>
										<td style={tdStyle}>{r.off.p99FrameTime}ms</td>
										<td style={{ ...tdStyle, color: "#4ade80" }}>{r.on.avgFps}</td>
										<td style={{ ...tdStyle, color: "#4ade80" }}>{r.on.avgFrameTime}ms</td>
										<td style={{ ...tdStyle, color: "#4ade80" }}>{r.on.p99FrameTime}ms</td>
										<td
											style={{
												...tdStyle,
												color: speedup > 1 ? "#4ade80" : "#f87171",
												fontWeight: 600,
											}}
										>
											{speedup.toFixed(1)}x
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

const rootStyle: React.CSSProperties = {
	width: "100vw",
	height: "100vh",
	display: "flex",
	flexDirection: "column",
	fontFamily: "system-ui, sans-serif",
	background: "#0f0f0f",
	color: "#e0e0e0",
};

const headerStyle: React.CSSProperties = {
	padding: "12px 20px",
	borderBottom: "1px solid #333",
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	flexShrink: 0,
	flexWrap: "wrap",
	gap: 8,
};

const selectStyle: React.CSSProperties = {
	background: "#222",
	color: "#e0e0e0",
	border: "1px solid #444",
	borderRadius: 4,
	padding: "4px 8px",
	fontSize: 13,
};

const buttonStyle: React.CSSProperties = {
	border: "none",
	borderRadius: 6,
	padding: "6px 16px",
	color: "#fff",
	fontSize: 13,
	fontWeight: 600,
};

const panelStyle: React.CSSProperties = {
	flex: 1,
	display: "flex",
	flexDirection: "column",
	minWidth: 0,
};

const panelHeaderStyle: React.CSSProperties = {
	padding: "8px 12px",
	borderBottom: "1px solid #333",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	fontSize: 13,
	flexShrink: 0,
};

const liveStatStyle: React.CSSProperties = { fontSize: 12, color: "#888" };

const resultsStyle: React.CSSProperties = {
	padding: "12px 20px",
	borderTop: "1px solid #333",
	maxHeight: 200,
	overflow: "auto",
	flexShrink: 0,
};

const resultHeaderStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	marginBottom: 8,
};

const thStyle: React.CSSProperties = { padding: "4px 8px", fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: "4px 8px" };
