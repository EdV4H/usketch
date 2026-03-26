import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import type { ShapeData, ShapeStyle } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useRef } from "react";

export function StylePanel() {
	const app = useApp();
	const store = app.store;

	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const styleSettings = useStoreSubscribe(store, (s) => s.getStyleSettings());
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

	// Get current display values
	const currentStyle = isSelectionMode ? getMergedStyle(styleableIds, shapes) : styleSettings;

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
			app.commands.execute(createBatchUpdateShapesCommand(store, updates));
		}
	}, [app.commands, store]);

	const applyStyle = useCallback(
		(key: keyof ShapeStyle, value: string | number) => {
			if (isSelectionMode) {
				for (const id of styleableIds) {
					const shape = shapes.get(id);
					if (shape) store.updateShape(id, { style: { ...shape.style, [key]: value } });
				}
			} else {
				store.setStyleSettings({ [key]: value });
			}
		},
		[isSelectionMode, styleableIds, store, shapes],
	);

	const handleSwatchClick = useCallback(
		(key: "fill" | "stroke", color: string) => {
			if (isSelectionMode) {
				captureBeforeSnapshots();
				applyStyle(key, color);
				// commit on next tick so beforeSnapshots is set
				setTimeout(() => commitCommand(), 0);
			} else {
				applyStyle(key, color);
			}
		},
		[isSelectionMode, captureBeforeSnapshots, applyStyle, commitCommand],
	);

	const handleColorPickerStart = useCallback(
		(_key: "fill" | "stroke") => () => {
			if (isSelectionMode) captureBeforeSnapshots();
		},
		[isSelectionMode, captureBeforeSnapshots],
	);

	const handleColorPickerChange = useCallback(
		(key: "fill" | "stroke") => (e: React.ChangeEvent<HTMLInputElement>) => {
			applyStyle(key, e.target.value);
		},
		[applyStyle],
	);

	const handleColorPickerBlur = useCallback(() => {
		if (isSelectionMode) commitCommand();
	}, [isSelectionMode, commitCommand]);

	const handleNumberChange = useCallback(
		(key: keyof ShapeStyle) => (e: React.ChangeEvent<HTMLInputElement>) => {
			const value = Number(e.target.value);
			if (isSelectionMode) {
				captureBeforeSnapshots();
				applyStyle(key, value);
				commitCommand();
			} else {
				applyStyle(key, value);
			}
		},
		[isSelectionMode, captureBeforeSnapshots, applyStyle, commitCommand],
	);

	const handleOpacityStart = useCallback(() => {
		if (isSelectionMode) captureBeforeSnapshots();
	}, [isSelectionMode, captureBeforeSnapshots]);

	const handleOpacityChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			applyStyle("opacity", Number(e.target.value));
		},
		[applyStyle],
	);

	const handleOpacityEnd = useCallback(() => {
		if (isSelectionMode) commitCommand();
	}, [isSelectionMode, commitCommand]);

	if (hasOnlyNonStyleable) return null;

	return (
		<div
			style={{
				position: "fixed",
				top: 64,
				right: 12,
				width: 200,
				zIndex: 100,
				background: "white",
				borderRadius: 8,
				boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
				padding: 12,
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				fontSize: 12,
			}}
		>
			<div style={{ fontWeight: 600, marginBottom: 8, color: "#333" }}>Style</div>

			{/* Fill */}
			<ColorField
				label="Fill"
				value={typeof currentStyle.fill === "string" ? currentStyle.fill : "#ffffff"}
				mixed={currentStyle.fill === undefined}
				onSwatchClick={(color) => handleSwatchClick("fill", color)}
				onPickerPointerDown={handleColorPickerStart("fill")}
				onPickerChange={handleColorPickerChange("fill")}
				onPickerBlur={handleColorPickerBlur}
			/>

			{/* Stroke */}
			<ColorField
				label="Stroke"
				value={typeof currentStyle.stroke === "string" ? currentStyle.stroke : "#1e1e1e"}
				mixed={currentStyle.stroke === undefined}
				onSwatchClick={(color) => handleSwatchClick("stroke", color)}
				onPickerPointerDown={handleColorPickerStart("stroke")}
				onPickerChange={handleColorPickerChange("stroke")}
				onPickerBlur={handleColorPickerBlur}
			/>

			{/* Stroke Width */}
			<StyleRow label="Width">
				<input
					type="number"
					min={0}
					max={20}
					step={1}
					value={currentStyle.strokeWidth ?? ""}
					placeholder="mixed"
					onChange={handleNumberChange("strokeWidth")}
					style={numberInputStyle}
				/>
				<span style={{ color: "#999", marginLeft: 2 }}>px</span>
			</StyleRow>

			{/* Opacity */}
			<StyleRow label="Opacity">
				<input
					type="range"
					min={0}
					max={1}
					step={0.01}
					value={currentStyle.opacity ?? 1}
					onPointerDown={handleOpacityStart}
					onChange={handleOpacityChange}
					onPointerUp={handleOpacityEnd}
					style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
				/>
				<span style={{ width: 36, textAlign: "right", color: "#333" }}>
					{currentStyle.opacity !== undefined ? `${Math.round(currentStyle.opacity * 100)}%` : "—"}
				</span>
			</StyleRow>
		</div>
	);
}

function StyleRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				marginBottom: 6,
			}}
		>
			<span style={{ width: 48, color: "#666", flexShrink: 0 }}>{label}</span>
			{children}
		</div>
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

function ColorField({
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
	const isTransparent = value === TRANSPARENT;
	const pickerValue = isTransparent ? "#ffffff" : value;
	return (
		<div style={{ marginBottom: 8 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
				<span style={{ width: 48, color: "#666", flexShrink: 0 }}>{label}</span>
				<input
					type="color"
					value={pickerValue}
					onPointerDown={onPickerPointerDown}
					onChange={onPickerChange}
					onBlur={onPickerBlur}
					style={{
						width: 24,
						height: 24,
						border: "1px solid #e0e0e0",
						borderRadius: 4,
						padding: 0,
						cursor: "pointer",
						background: "none",
					}}
				/>
				<span style={{ color: mixed ? "#999" : "#333", fontFamily: "monospace", fontSize: 11 }}>
					{mixed ? "mixed" : isTransparent ? "none" : value}
				</span>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(6, 1fr)",
					gap: 3,
					paddingLeft: 48 + 6,
				}}
			>
				{COLOR_PALETTE.map((color) => {
					const isActive = value === color && !mixed;
					const isTrans = color === TRANSPARENT;
					return (
						<button
							key={color}
							type="button"
							onClick={() => onSwatchClick(color)}
							title={isTrans ? "Transparent" : color}
							style={{
								width: 20,
								height: 20,
								borderRadius: 4,
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
		</div>
	);
}

const CHECKER_BG = "repeating-conic-gradient(#e0e0e0 0% 25%, white 0% 50%) 0 0 / 10px 10px";

const numberInputStyle: React.CSSProperties = {
	width: 48,
	height: 24,
	border: "1px solid #e0e0e0",
	borderRadius: 4,
	padding: "0 4px",
	fontSize: 12,
	textAlign: "center",
};

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
