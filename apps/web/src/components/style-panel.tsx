import { ShapeAnchorOverlay, useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import type { ShapeData, ShapeStyle } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useEffect, useRef, useState } from "react";

export function StylePanel() {
	const app = useApp();
	const store = app.store;

	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const shapes = useStoreSubscribe(store, (s) => s.getShapes());

	const beforeSnapshotsRef = useRef<Map<string, ShapeData> | null>(null);

	// Filter styleable shapes
	const styleableIds = [...selection].filter((id) => {
		const shape = shapes.get(id);
		return shape && !shape.type.startsWith("wireframe-") && shape.type !== "group";
	});

	const isSelectionMode = styleableIds.length > 0;

	// Check if selection contains only non-styleable shapes
	const hasOnlyNonStyleable = selection.size > 0 && styleableIds.length === 0;

	// Get current display values from selected shapes
	const currentStyle = getMergedStyle(styleableIds, shapes);

	// Clear pending snapshots when selection changes to avoid stale refs
	// biome-ignore lint/correctness/useExhaustiveDependencies: selection is intentional trigger
	useEffect(() => {
		beforeSnapshotsRef.current = null;
	}, [selection]);

	const captureBeforeSnapshots = useCallback(() => {
		if (beforeSnapshotsRef.current) return;
		const snapshots = new Map<string, ShapeData>();
		for (const id of styleableIds) {
			const shape = shapes.get(id);
			if (shape) snapshots.set(id, { ...shape });
		}
		beforeSnapshotsRef.current = snapshots;
	}, [styleableIds, shapes]);

	const commitCommand = useCallback(() => {
		const before = beforeSnapshotsRef.current;
		if (!before) return;
		beforeSnapshotsRef.current = null;

		const updates: Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }> = [];
		for (const [id, snapshot] of before) {
			const current = store.getShape(id);
			if (current) {
				updates.push({ id, from: { style: snapshot.style }, to: { style: current.style } });
			}
		}
		if (updates.length > 0) {
			// Revert to before state, then let the command be the single source of truth
			for (const [id, snapshot] of before) {
				store.updateShape(id, { style: snapshot.style });
			}
			app.commands.execute(createBatchUpdateShapesCommand(store, updates));
		}
	}, [app.commands, store]);

	const applyStyle = useCallback(
		(key: keyof ShapeStyle, value: string | number) => {
			for (const id of styleableIds) {
				const shape = shapes.get(id);
				if (shape) store.updateShape(id, { style: { ...shape.style, [key]: value } });
			}
		},
		[styleableIds, store, shapes],
	);

	const handleSwatchClick = useCallback(
		(key: "fill" | "stroke", color: string) => {
			captureBeforeSnapshots();
			applyStyle(key, color);
			queueMicrotask(commitCommand);
		},
		[captureBeforeSnapshots, applyStyle, commitCommand],
	);

	const handleColorPickerStart = useCallback(
		(_key: "fill" | "stroke") => () => {
			captureBeforeSnapshots();
		},
		[captureBeforeSnapshots],
	);

	const handleColorPickerChange = useCallback(
		(key: "fill" | "stroke") => (e: React.ChangeEvent<HTMLInputElement>) => {
			applyStyle(key, e.target.value);
		},
		[applyStyle],
	);

	const handleColorPickerBlur = useCallback(() => {
		commitCommand();
	}, [commitCommand]);

	const handleNumberChange = useCallback(
		(key: keyof ShapeStyle) => (e: React.ChangeEvent<HTMLInputElement>) => {
			const raw = e.target.value;
			if (raw === "") return;
			const value = Number(raw);
			if (!Number.isFinite(value)) return;
			const clamped = Math.max(0, Math.min(20, value));
			captureBeforeSnapshots();
			applyStyle(key, clamped);
			commitCommand();
		},
		[captureBeforeSnapshots, applyStyle, commitCommand],
	);

	const handleOpacityStart = useCallback(() => {
		captureBeforeSnapshots();
	}, [captureBeforeSnapshots]);

	const handleOpacityChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			applyStyle("opacity", Number(e.target.value));
		},
		[applyStyle],
	);

	const handleOpacityEnd = useCallback(() => {
		commitCommand();
	}, [commitCommand]);

	if (!isSelectionMode || hasOnlyNonStyleable) return null;

	return (
		<ShapeAnchorOverlay shapeIds={styleableIds} position="top" fallback="bottom" gap={12}>
			<div onPointerDown={(e) => e.stopPropagation()} style={anchoredBarStyle}>
				<CompactColorPicker
					label="Fill"
					value={typeof currentStyle.fill === "string" ? currentStyle.fill : "#ffffff"}
					mixed={currentStyle.fill === undefined}
					onSwatchClick={(color) => handleSwatchClick("fill", color)}
					onPickerPointerDown={handleColorPickerStart("fill")}
					onPickerChange={handleColorPickerChange("fill")}
					onPickerBlur={handleColorPickerBlur}
				/>
				<div style={barSepStyle} />
				<CompactColorPicker
					label="Stroke"
					value={typeof currentStyle.stroke === "string" ? currentStyle.stroke : "#1e1e1e"}
					mixed={currentStyle.stroke === undefined}
					onSwatchClick={(color) => handleSwatchClick("stroke", color)}
					onPickerPointerDown={handleColorPickerStart("stroke")}
					onPickerChange={handleColorPickerChange("stroke")}
					onPickerBlur={handleColorPickerBlur}
				/>
				<div style={barSepStyle} />
				<input
					type="number"
					min={0}
					max={20}
					step={1}
					value={currentStyle.strokeWidth ?? ""}
					placeholder="W"
					title="Stroke Width"
					onChange={handleNumberChange("strokeWidth")}
					style={compactNumberStyle}
				/>
				<div style={barSepStyle} />
				<input
					type="range"
					min={0}
					max={1}
					step={0.01}
					value={currentStyle.opacity ?? 1}
					title="Opacity"
					onPointerDown={handleOpacityStart}
					onChange={handleOpacityChange}
					onPointerUp={handleOpacityEnd}
					onFocus={handleOpacityStart}
					onBlur={handleOpacityEnd}
					style={{ width: 48, cursor: "pointer" }}
				/>
				<span style={{ fontSize: 10, color: "#666", minWidth: 28, textAlign: "right" }}>
					{currentStyle.opacity !== undefined ? `${Math.round(currentStyle.opacity * 100)}%` : "—"}
				</span>
			</div>
		</ShapeAnchorOverlay>
	);
}

const TRANSPARENT = "transparent";
const COLOR_PALETTE = [
	TRANSPARENT,
	"#ffffff",
	"#737373",
	"#1e1e1e",
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
];

const CHECKER_BG = "repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 0 0 / 10px 10px";

// ── Anchored toolbar styles ──

const anchoredBarStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "4px 8px",
	background: "#fff",
	borderRadius: 8,
	boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
	fontFamily: "system-ui, sans-serif",
	fontSize: 11,
	whiteSpace: "nowrap",
	pointerEvents: "auto",
};

const barSepStyle: React.CSSProperties = {
	width: 1,
	height: 18,
	background: "#e0e0e0",
	flexShrink: 0,
};

const compactNumberStyle: React.CSSProperties = {
	width: 36,
	height: 22,
	border: "1px solid #e0e0e0",
	borderRadius: 4,
	padding: "0 3px",
	fontSize: 11,
	textAlign: "center",
};

function CompactColorPicker({
	label,
	value,
	mixed,
	onSwatchClick,
	onPickerPointerDown,
	onPickerChange,
	onPickerBlur,
}: {
	label: string;
	value: string;
	mixed: boolean;
	onSwatchClick: (color: string) => void;
	onPickerPointerDown: () => void;
	onPickerChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onPickerBlur: () => void;
}) {
	const [showPalette, setShowPalette] = useState(false);
	const isTransparent = value === TRANSPARENT;
	const pickerValue = isTransparent ? "#ffffff" : value;

	return (
		<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 3 }}>
			<span style={{ color: "#666", fontSize: 10 }}>{label}</span>
			<input
				type="color"
				value={pickerValue}
				onPointerDown={onPickerPointerDown}
				onChange={onPickerChange}
				onBlur={onPickerBlur}
				style={{
					width: 20,
					height: 20,
					border: "1px solid #e0e0e0",
					borderRadius: 4,
					padding: 0,
					cursor: "pointer",
					background: "none",
				}}
			/>
			<button
				type="button"
				onClick={() => setShowPalette((v) => !v)}
				style={{
					width: 16,
					height: 16,
					border: "none",
					background: "none",
					cursor: "pointer",
					padding: 0,
					fontSize: 8,
					color: "#999",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
				title="Color palette"
			>
				▼
			</button>
			{showPalette && (
				<div
					style={{
						position: "absolute",
						top: 28,
						left: 0,
						background: "#fff",
						border: "1px solid #e0e0e0",
						borderRadius: 8,
						padding: 6,
						display: "grid",
						gridTemplateColumns: "repeat(6, 1fr)",
						gap: 3,
						boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
						zIndex: 200,
					}}
				>
					{COLOR_PALETTE.map((color) => {
						const isActive = value === color && !mixed;
						const isTrans = color === TRANSPARENT;
						return (
							<button
								key={color}
								type="button"
								onClick={() => {
									onSwatchClick(color);
									setShowPalette(false);
								}}
								title={isTrans ? "Transparent" : color}
								style={{
									width: 18,
									height: 18,
									borderRadius: 3,
									border: isActive ? "2px solid #3b82f6" : "1px solid #e0e0e0",
									background: isTrans ? CHECKER_BG : color,
									cursor: "pointer",
									padding: 0,
									position: "relative",
									overflow: "hidden",
								}}
							>
								{isTrans && (
									<span
										style={{
											position: "absolute",
											top: "50%",
											left: -2,
											width: "130%",
											height: 2,
											background: "#ef4444",
											transform: "rotate(-45deg)",
											transformOrigin: "center",
											pointerEvents: "none",
										}}
									/>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

type MergedStyle = { [K in keyof ShapeStyle]: ShapeStyle[K] | undefined };

function getMergedStyle(ids: string[], shapes: ReadonlyMap<string, ShapeData>): MergedStyle {
	const result: MergedStyle = {
		fill: undefined,
		stroke: undefined,
		strokeWidth: undefined,
		opacity: undefined,
	};
	let first = true;
	for (const id of ids) {
		const shape = shapes.get(id);
		if (!shape) continue;
		const s = shape.style;
		if (first) {
			result.fill = s.fill;
			result.stroke = s.stroke;
			result.strokeWidth = s.strokeWidth;
			result.opacity = s.opacity;
			first = false;
		} else {
			if (result.fill !== s.fill) result.fill = undefined;
			if (result.stroke !== s.stroke) result.stroke = undefined;
			if (result.strokeWidth !== s.strokeWidth) result.strokeWidth = undefined;
			if (result.opacity !== s.opacity) result.opacity = undefined;
		}
	}
	return result;
}
