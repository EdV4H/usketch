import { useRef, useSyncExternalStore } from "react";
import { ERASER_RANGE, SIZE_RANGE } from "../config.js";
import { PEN_KINDS, PEN_META, PRESET_COLORS } from "../pen-meta.js";
import type { FreedrawSettingsStore } from "../settings-store.js";
import type { PenKind } from "../types.js";

/** boolean ストア（ツールがアクティブかどうか）。 */
export interface BoolStore {
	getSnapshot(): boolean;
	subscribe(listener: () => void): () => void;
}

interface Props {
	settings: FreedrawSettingsStore;
	active: BoolStore;
}

const ACCENT = "#7c3aed";

/** freedraw ツールがアクティブな間だけ表示する最小フローティングパレット。 */
export function FreedrawPalette({ settings, active }: Props) {
	const isActive = useSyncExternalStore(active.subscribe, active.getSnapshot);
	const s = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
	const colorInputRef = useRef<HTMLInputElement>(null);
	if (!isActive) return null;

	const eraser = s.mode === "eraser";
	const colors = [...PRESET_COLORS, ...s.customColors.filter((c) => !PRESET_COLORS.includes(c))];
	const sizeValue = eraser ? s.eraserSize : s.sizes[s.pen];
	const range = eraser ? ERASER_RANGE : SIZE_RANGE;

	const selectPen = (pen: PenKind) => settings.update({ pen, mode: "pen" });

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{/* パレットへのポインタがキャンバスへ伝播して描画が始まるのを防ぐ */}
			<div
				onPointerDown={(e) => e.stopPropagation()}
				onPointerMove={(e) => e.stopPropagation()}
				onPointerUp={(e) => e.stopPropagation()}
				style={{
					position: "absolute",
					left: "50%",
					bottom: 20,
					transform: "translateX(-50%)",
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "8px 12px",
					borderRadius: 9999,
					background: "#ffffff",
					border: "1px solid #e5e7eb",
					boxShadow: "0 6px 24px rgba(0,0,0,0.16)",
					font: "12px ui-sans-serif, system-ui, sans-serif",
					color: "#111827",
					pointerEvents: "auto",
					userSelect: "none",
				}}
			>
				{/* ペン種別 */}
				{PEN_KINDS.map((pen) => {
					const selected = !eraser && s.pen === pen;
					return (
						<button
							key={pen}
							type="button"
							title={PEN_META[pen].label}
							onClick={() => selectPen(pen)}
							style={{
								border: "none",
								borderRadius: 10,
								padding: "5px 9px",
								cursor: "pointer",
								background: selected ? "#ede9fe" : "transparent",
								color: selected ? ACCENT : "#374151",
								fontWeight: selected ? 700 : 400,
							}}
						>
							{PEN_META[pen].label}
						</button>
					);
				})}

				{/* 消しゴム */}
				<button
					type="button"
					title="消しゴム"
					onClick={() => settings.update({ mode: eraser ? "pen" : "eraser" })}
					style={{
						border: "none",
						borderRadius: 10,
						padding: "5px 9px",
						cursor: "pointer",
						background: eraser ? "#ede9fe" : "transparent",
						color: eraser ? ACCENT : "#374151",
						fontWeight: eraser ? 700 : 400,
					}}
				>
					消しゴム
				</button>

				<span style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 2px" }} />

				{/* 色 */}
				{colors.map((c) => {
					const sel = c.toLowerCase() === s.color.toLowerCase() && !eraser;
					return (
						<button
							key={c}
							type="button"
							title={c}
							onClick={() => settings.update({ color: c, mode: "pen" })}
							style={{
								width: 22,
								height: 22,
								borderRadius: 9999,
								border: "none",
								padding: 0,
								cursor: "pointer",
								background: c,
								boxShadow: sel
									? `inset 0 0 0 1px rgba(0,0,0,.15), 0 0 0 2px #fff, 0 0 0 4px ${ACCENT}`
									: "inset 0 0 0 1px rgba(0,0,0,.18)",
							}}
						/>
					);
				})}
				<button
					type="button"
					title="色を追加"
					onClick={() => colorInputRef.current?.click()}
					style={{
						width: 22,
						height: 22,
						borderRadius: 9999,
						border: "1.5px dashed #9ca3af",
						background: "#fff",
						color: "#6b7280",
						cursor: "pointer",
						lineHeight: 1,
					}}
				>
					+
				</button>
				<input
					ref={colorInputRef}
					type="color"
					onChange={(e) => {
						const v = e.target.value;
						const next = s.customColors.includes(v) ? s.customColors : [...s.customColors, v];
						settings.update({ customColors: next, color: v, mode: "pen" });
					}}
					style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
				/>

				<span style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 2px" }} />

				{/* 太さ */}
				<input
					type="range"
					min={range.min}
					max={range.max}
					step={range.step}
					value={sizeValue}
					onChange={(e) => {
						const v = Number.parseFloat(e.target.value);
						if (eraser) settings.update({ eraserSize: v });
						else settings.update({ sizes: { ...s.sizes, [s.pen]: v } });
					}}
					style={{ width: 96, cursor: "pointer", accentColor: ACCENT }}
				/>
				<span style={{ minWidth: 34, textAlign: "right", color: "#374151" }}>{sizeValue}px</span>
			</div>
		</div>
	);
}
