import type { BoardStore } from "@edv4h/usketch-shared";
import { useCallback, useRef, useState } from "react";
import { BenchmarkCanvas, clearShapes, loadShapes } from "./benchmark/benchmark-canvas.js";
import { type PerfStats, PerfTracker } from "./benchmark/perf-tracker.js";
import { generateShapes, type ShapeMix } from "./benchmark/shape-generator.js";

const SHAPE_COUNTS = [100, 1_000, 5_000, 10_000, 42_000];
const TEST_DURATION_MS = 5_000;
const PAN_SPEED = 3;
const WARMUP_FRAMES = 10;
const DEFAULT_BOARD_V2_URL = "http://localhost:3000";

interface BenchResult {
	dom: PerfStats;
	gpu: PerfStats;
	shapeCount: number;
	shapeMix: ShapeMix;
}

export function BenchmarkPage() {
	const [shapeCount, setShapeCount] = useState(1_000);
	const [shapeMix, setShapeMix] = useState<ShapeMix>("mixed");
	const [running, setRunning] = useState(false);
	const [results, setResults] = useState<BenchResult[]>([]);
	const [liveDom, setLiveDom] = useState({ fps: 0, frameTime: 0 });
	const [liveGpu, setLiveGpu] = useState({ fps: 0, frameTime: 0 });
	const [boardV2Url, setBoardV2Url] = useState(DEFAULT_BOARD_V2_URL);
	const [showBoardV2, setShowBoardV2] = useState(true);

	const domStoreRef = useRef<BoardStore | null>(null);
	const gpuStoreRef = useRef<BoardStore | null>(null);
	const rafRef = useRef(0);

	const onDomReady = useCallback((store: BoardStore) => {
		domStoreRef.current = store;
	}, []);
	const onGpuReady = useCallback((store: BoardStore) => {
		gpuStoreRef.current = store;
	}, []);

	function startBenchmark() {
		const domStore = domStoreRef.current;
		const gpuStore = gpuStoreRef.current;
		if (!domStore || !gpuStore) return;

		clearShapes(domStore);
		clearShapes(gpuStore);

		const shapes = generateShapes(shapeCount, shapeMix);
		loadShapes(domStore, shapes);
		loadShapes(gpuStore, shapes);

		domStore.setViewport({ x: 0, y: 0, zoom: 1 });
		gpuStore.setViewport({ x: 0, y: 0, zoom: 1 });

		setRunning(true);

		const domTracker = new PerfTracker();
		const gpuTracker = new PerfTracker();
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
				domTracker.recordFrame(dt);
				gpuTracker.recordFrame(dt);
			}

			domStore?.panBy(PAN_SPEED, 0);
			gpuStore?.panBy(PAN_SPEED, 0);

			if (frameIndex % 5 === 0) {
				setLiveDom({ fps: domTracker.getLiveFps(), frameTime: domTracker.getLiveFrameTime() });
				setLiveGpu({ fps: gpuTracker.getLiveFps(), frameTime: gpuTracker.getLiveFrameTime() });
			}

			if (elapsed < TEST_DURATION_MS) {
				rafRef.current = requestAnimationFrame(frame);
			} else {
				setRunning(false);
				setResults((prev) => [
					...prev,
					{
						dom: domTracker.getStats(),
						gpu: gpuTracker.getStats(),
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
					<span style={{ fontSize: 12, color: "#888" }}>
						DOM/SVG vs WebGPU{showBoardV2 ? " vs board-v2" : ""}
					</span>
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
					<label style={{ display: "flex", alignItems: "center", gap: 4 }}>
						<input
							type="checkbox"
							checked={showBoardV2}
							onChange={(e) => setShowBoardV2(e.target.checked)}
						/>
						board-v2
					</label>
					{showBoardV2 && (
						<input
							value={boardV2Url}
							onChange={(e) => setBoardV2Url(e.target.value)}
							placeholder="board-v2 URL"
							style={{ ...selectStyle, width: 180 }}
						/>
					)}
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
				{/* DOM panel */}
				<div style={{ ...panelStyle, borderRight: "1px solid #333" }}>
					<div style={panelHeaderStyle}>
						<span style={{ fontWeight: 600 }}>uSketch DOM/SVG</span>
						<span style={liveStatStyle}>
							FPS: {liveDom.fps} · Frame: {liveDom.frameTime}ms
						</span>
					</div>
					<div style={{ flex: 1, position: "relative" }}>
						<BenchmarkCanvas rendererType="dom" onReady={onDomReady} />
					</div>
				</div>

				{/* GPU panel */}
				<div
					style={{
						...panelStyle,
						...(showBoardV2 ? { borderRight: "1px solid #333" } : {}),
					}}
				>
					<div style={panelHeaderStyle}>
						<span style={{ fontWeight: 600 }}>uSketch WebGPU</span>
						<span style={liveStatStyle}>
							FPS: {liveGpu.fps} · Frame: {liveGpu.frameTime}ms
						</span>
					</div>
					<div style={{ flex: 1, position: "relative" }}>
						<BenchmarkCanvas rendererType="gpu" onReady={onGpuReady} />
					</div>
				</div>

				{/* board-v2 panel (iframe) */}
				{showBoardV2 && (
					<div style={panelStyle}>
						<div style={panelHeaderStyle}>
							<span style={{ fontWeight: 600 }}>board-v2 WebGPU</span>
							<span style={liveStatStyle}>
								<a
									href={boardV2Url}
									target="_blank"
									rel="noopener noreferrer"
									style={{ color: "#60a5fa", textDecoration: "none", fontSize: 11 }}
								>
									Open in new tab
								</a>
							</span>
						</div>
						<div style={{ flex: 1, position: "relative" }}>
							<iframe
								src={boardV2Url}
								title="board-v2 benchmark"
								style={{
									position: "absolute",
									inset: 0,
									width: "100%",
									height: "100%",
									border: "none",
									background: "#1a1a2e",
								}}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Results */}
			{results.length > 0 && (
				<div style={resultsStyle}>
					<div style={resultHeaderStyle}>
						<span style={{ fontSize: 14, fontWeight: 600 }}>Results (uSketch)</span>
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
								<th style={thStyle}>DOM FPS</th>
								<th style={thStyle}>DOM Frame</th>
								<th style={thStyle}>DOM P99</th>
								<th style={thStyle}>GPU FPS</th>
								<th style={thStyle}>GPU Frame</th>
								<th style={thStyle}>GPU P99</th>
								<th style={thStyle}>Speedup</th>
							</tr>
						</thead>
						<tbody>
							{results.map((r, i) => {
								const speedup =
									r.dom.avgFrameTime > 0 ? r.dom.avgFrameTime / r.gpu.avgFrameTime : 0;
								return (
									<tr
										key={`${r.shapeCount}-${r.shapeMix}-${i}`}
										style={{ borderTop: "1px solid #333" }}
									>
										<td style={tdStyle}>{r.shapeCount.toLocaleString()}</td>
										<td style={tdStyle}>{r.shapeMix}</td>
										<td style={tdStyle}>{r.dom.avgFps}</td>
										<td style={tdStyle}>{r.dom.avgFrameTime}ms</td>
										<td style={tdStyle}>{r.dom.p99FrameTime}ms</td>
										<td style={{ ...tdStyle, color: "#4ade80" }}>{r.gpu.avgFps}</td>
										<td style={{ ...tdStyle, color: "#4ade80" }}>{r.gpu.avgFrameTime}ms</td>
										<td style={{ ...tdStyle, color: "#4ade80" }}>{r.gpu.p99FrameTime}ms</td>
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
					{showBoardV2 && (
						<p style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
							board-v2 の計測は board-v2 側の UI (Stress 2K ボタン / benchmark.html)
							で実行してください。
						</p>
					)}
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
