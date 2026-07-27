// Map palette — a fixed on-canvas panel shown while the `map` tool is active.
// Lets the user pick the paint mode, terrain, icon, and visual Tweaks. All state
// lives in the module stores (tool-state / render-config); this is just the UI.
import type { BoardStore, CommandRegistry } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import { genStateStore, useGenState } from "../gen-state.js";
import { generateIntoBox, viewportCellBox } from "../generate.js";
import { defaultParams, GENERATORS, GENERATORS_BY_ID } from "../generators/index.js";
import { ICON_CATEGORIES, ICONS, type IconCategory } from "../icons.js";
import { WOBBLE_FILTER_ID } from "../map-layer.js";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { terrainCssVars } from "../palette.js";
import { renderConfigStore, useRenderConfig } from "../render-config.js";
import { renderSvgNodes } from "../svg-nodes.js";
import { TERRAINS, terrainPatternId } from "../terrain.js";
import { type MapMode, toolStateStore, useMapToolState } from "../tool-state.js";

const MODES: { id: MapMode; label: string }[] = [
	{ id: "brush", label: "ブラシ" },
	{ id: "eraser", label: "消しゴム" },
	{ id: "fill", label: "塗りつぶし" },
	{ id: "stamp", label: "アイコン" },
	{ id: "generate", label: "生成" },
];

function useActiveTool(store: BoardStore): string {
	const [id, setId] = useState(store.getActiveToolId());
	useEffect(() => {
		const u = store.subscribe(() => setId(store.getActiveToolId()));
		return u;
	}, [store]);
	return id;
}

const CARD = "#FFFFFF";
const STROKE = "#141414";

function chipStyle(active: boolean): React.CSSProperties {
	return {
		border: `2px solid ${STROKE}`,
		borderRadius: 10,
		background: active ? "#F6C124" : CARD,
		padding: "5px 10px",
		font: "600 12px system-ui, sans-serif",
		cursor: "pointer",
		lineHeight: 1,
	};
}

export function MapPalette({
	store,
	commands,
	tile,
}: {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}) {
	const activeTool = useActiveTool(store);
	const tool = useMapToolState();
	const cfg = useRenderConfig();
	const gen = useGenState();
	const [cat, setCat] = useState<IconCategory>("landmark");

	if (activeTool !== MAP_TOOL_ID) return null;

	const generator = GENERATORS_BY_ID.get(gen.algorithmId) ?? GENERATORS[0];
	const runGenerate = (box: import("../autotile.js").CellBox) =>
		generateIntoBox(
			{ store, commands, tile },
			{ generatorId: gen.algorithmId, seed: gen.seed, params: gen.params, box },
		);

	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);
	const wobble = cfg.lineStyle === "wobble" ? `url(#${WOBBLE_FILTER_ID})` : undefined;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<div
				style={{
					position: "absolute",
					left: 14,
					top: "50%",
					transform: "translateY(-50%)",
					pointerEvents: "auto",
					width: 244,
					maxHeight: "84vh",
					overflowY: "auto",
					background: "#FBF9F4",
					border: `2.6px dashed ${STROKE}`,
					borderRadius: 16,
					padding: 14,
					boxShadow: "0 6px 24px rgba(0,0,0,.14)",
					...(cssVars as React.CSSProperties),
				}}
			>
				<div style={{ font: "700 15px system-ui, sans-serif", marginBottom: 10 }}>🗺 RPG マップ</div>

				{/* Mode */}
				<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
					{MODES.map((m) => (
						<button
							type="button"
							key={m.id}
							onClick={() => toolStateStore.set({ mode: m.id })}
							style={chipStyle(tool.mode === m.id)}
						>
							{m.label}
						</button>
					))}
				</div>

				{/* Terrain palette (brush/eraser/fill) */}
				{(tool.mode === "brush" || tool.mode === "eraser" || tool.mode === "fill") && (
					<div style={{ marginBottom: 12 }}>
						<div style={{ font: "600 11px system-ui", color: "#8a8a88", marginBottom: 6 }}>
							地形
						</div>
						{tool.mode === "eraser" && (
							<div style={{ font: "600 11px system-ui", color: "#8a8a88", marginBottom: 6 }}>
								アイコンはクリックで削除
							</div>
						)}
						<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
							{TERRAINS.map((t) => (
								<button
									type="button"
									key={t.key}
									title={`${t.name} / ${t.en}`}
									onClick={() => toolStateStore.set({ terrain: t.key })}
									style={{
										border: `2px solid ${tool.terrain === t.key ? "#EF5350" : STROKE}`,
										borderRadius: 8,
										padding: 0,
										overflow: "hidden",
										cursor: "pointer",
										aspectRatio: "1",
										background: CARD,
									}}
								>
									<svg width="100%" height="100%" viewBox="0 0 40 40" style={{ display: "block" }}>
										<rect width="40" height="40" fill={`url(#${terrainPatternId(t.key)})`} />
									</svg>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Icon palette (stamp) */}
				{tool.mode === "stamp" && (
					<div style={{ marginBottom: 12 }}>
						<div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
							{ICON_CATEGORIES.map((c) => (
								<button
									type="button"
									key={c.id}
									onClick={() => setCat(c.id)}
									style={chipStyle(cat === c.id)}
								>
									{c.label}
								</button>
							))}
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
							{ICONS.filter((i) => i.category === cat).map((i) => (
								<button
									type="button"
									key={i.key}
									title={`${i.ja} / ${i.en}`}
									onClick={() => toolStateStore.set({ iconKey: i.key })}
									style={{
										border: `2px solid ${tool.iconKey === i.key ? "#EF5350" : STROKE}`,
										borderRadius: 8,
										padding: 3,
										cursor: "pointer",
										aspectRatio: "1",
										background: CARD,
									}}
								>
									<svg width="100%" height="100%" viewBox={i.viewBox} filter={wobble}>
										{renderSvgNodes(i.nodes, `pal-${i.key}`)}
									</svg>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Generation */}
				{tool.mode === "generate" && (
					<div style={{ marginBottom: 12 }}>
						<div style={{ font: "600 11px system-ui", color: "#8a8a88", marginBottom: 6 }}>
							アルゴリズム
						</div>
						<select
							value={gen.algorithmId}
							onChange={(e) => {
								const g = GENERATORS_BY_ID.get(e.target.value);
								if (g) genStateStore.set({ algorithmId: g.id, params: defaultParams(g) });
							}}
							style={{
								width: "100%",
								border: `2px solid ${STROKE}`,
								borderRadius: 8,
								padding: "5px 8px",
								font: "600 12px system-ui",
								background: CARD,
								marginBottom: 10,
							}}
						>
							{GENERATORS.map((g) => (
								<option key={g.id} value={g.id}>
									{g.label}
								</option>
							))}
						</select>

						<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
							<span style={{ font: "600 11px system-ui" }}>seed</span>
							<input
								type="number"
								value={gen.seed}
								onChange={(e) => genStateStore.set({ seed: Number(e.target.value) >>> 0 })}
								style={{
									flex: 1,
									minWidth: 0,
									border: `2px solid ${STROKE}`,
									borderRadius: 8,
									padding: "4px 6px",
									font: "600 12px system-ui",
								}}
							/>
							<button
								type="button"
								title="新しいシード"
								onClick={() =>
									genStateStore.set({ seed: Math.floor(Math.random() * 0xffffffff) >>> 0 })
								}
								style={chipStyle(false)}
							>
								🎲
							</button>
						</div>

						{generator.params.map((p) => (
							<label
								key={p.name}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 6,
									font: "600 11px system-ui",
									marginBottom: 6,
								}}
							>
								<span style={{ width: 96 }}>{p.label}</span>
								<input
									type="range"
									min={p.min}
									max={p.max}
									step={p.step}
									value={gen.params[p.name] ?? p.default}
									onChange={(e) =>
										genStateStore.set({
											params: { ...gen.params, [p.name]: Number(e.target.value) },
										})
									}
									style={{ flex: 1, minWidth: 0 }}
								/>
							</label>
						))}

						<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
							<button
								type="button"
								onClick={() => runGenerate(viewportCellBox(store, tile))}
								style={chipStyle(true)}
							>
								ビュー全体に生成
							</button>
							<button
								type="button"
								disabled={!gen.lastBox}
								onClick={() => gen.lastBox && runGenerate(gen.lastBox)}
								style={{ ...chipStyle(false), opacity: gen.lastBox ? 1 : 0.5 }}
							>
								再生成
							</button>
						</div>
						<div style={{ font: "600 11px system-ui", color: "#8a8a88", marginTop: 8 }}>
							キャンバスをドラッグで範囲生成
						</div>
					</div>
				)}

				{/* Tweaks */}
				<div style={{ borderTop: `2px dashed ${STROKE}`, paddingTop: 10 }}>
					<div style={{ font: "600 11px system-ui", color: "#8a8a88", marginBottom: 6 }}>
						Tweaks
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
						<button
							type="button"
							onClick={() =>
								renderConfigStore.set({ colorMode: cfg.colorMode === "color" ? "mono" : "color" })
							}
							style={chipStyle(false)}
						>
							{cfg.colorMode === "color" ? "カラフル" : "モノクロ"}
						</button>
						<button
							type="button"
							onClick={() =>
								renderConfigStore.set({
									lineStyle: cfg.lineStyle === "wobble" ? "clean" : "wobble",
								})
							}
							style={chipStyle(false)}
						>
							{cfg.lineStyle === "wobble" ? "揺らぎ線" : "クリーン線"}
						</button>
						<label
							style={{ font: "600 11px system-ui", display: "flex", alignItems: "center", gap: 4 }}
						>
							線
							<input
								type="range"
								min={0.5}
								max={2}
								step={0.1}
								value={cfg.strokeScale}
								onChange={(e) => renderConfigStore.set({ strokeScale: Number(e.target.value) })}
								style={{ width: 80 }}
							/>
						</label>
					</div>
				</div>
			</div>
		</div>
	);
}
