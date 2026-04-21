import { ShapeAnchorOverlay, useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import type { ShapeData, ShapeStyle } from "@edv4h/usketch-shared";
import {
	createBatchUpdateShapesCommand,
	createBringSelectionToFrontCommand,
	createSendSelectionToBackCommand,
} from "@edv4h/usketch-store";
import { useCallback, useEffect, useRef } from "react";
import { CompactColorPicker } from "./compact-color-picker.js";

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

	const handleBringToFront = useCallback(() => {
		if (styleableIds.length === 0) return;
		app.commands.execute(createBringSelectionToFrontCommand(store, styleableIds));
	}, [app.commands, store, styleableIds]);

	const handleSendToBack = useCallback(() => {
		if (styleableIds.length === 0) return;
		app.commands.execute(createSendSelectionToBackCommand(store, styleableIds));
	}, [app.commands, store, styleableIds]);

	if (!isSelectionMode || hasOnlyNonStyleable) return null;

	return (
		<ShapeAnchorOverlay shapeIds={styleableIds} position="top" fallback="bottom">
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
				<span
					style={{
						fontSize: 10,
						color: "var(--fg-secondary)",
						minWidth: 28,
						textAlign: "right",
					}}
				>
					{currentStyle.opacity !== undefined ? `${Math.round(currentStyle.opacity * 100)}%` : "—"}
				</span>
				<div style={barSepStyle} />
				<button
					type="button"
					onClick={handleSendToBack}
					title="最背面へ (Ctrl+Shift+[)"
					aria-label="最背面へ"
					style={zOrderButtonStyle}
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
						<title>最背面へ</title>
						<rect
							x="1"
							y="1"
							width="9"
							height="9"
							fill="var(--brand-violet)"
							stroke="var(--fg-primary)"
						/>
						<rect
							x="6"
							y="6"
							width="9"
							height="9"
							fill="var(--bg-surface-solid)"
							stroke="var(--fg-primary)"
						/>
					</svg>
				</button>
				<button
					type="button"
					onClick={handleBringToFront}
					title="最前面へ (Ctrl+Shift+])"
					aria-label="最前面へ"
					style={zOrderButtonStyle}
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
						<title>最前面へ</title>
						<rect
							x="1"
							y="1"
							width="9"
							height="9"
							fill="var(--bg-surface-solid)"
							stroke="var(--fg-primary)"
						/>
						<rect
							x="6"
							y="6"
							width="9"
							height="9"
							fill="var(--brand-violet)"
							stroke="var(--fg-primary)"
						/>
					</svg>
				</button>
			</div>
		</ShapeAnchorOverlay>
	);
}

const zOrderButtonStyle: React.CSSProperties = {
	width: 24,
	height: 24,
	padding: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	background: "transparent",
	border: "1px solid transparent",
	borderRadius: 4,
	cursor: "pointer",
};

const anchoredBarStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "5px 9px",
	background: "var(--bg-surface-raised)",
	backdropFilter: "blur(20px) saturate(1.4)",
	WebkitBackdropFilter: "blur(20px) saturate(1.4)",
	border: "1px solid var(--border-subtle)",
	borderRadius: 10,
	boxShadow: "var(--shadow-2)",
	fontFamily: "var(--font-sans, system-ui, sans-serif)",
	fontSize: 11,
	color: "var(--fg-primary)",
	whiteSpace: "nowrap",
	pointerEvents: "auto",
};

const barSepStyle: React.CSSProperties = {
	width: 1,
	height: 18,
	background: "var(--border-default)",
	flexShrink: 0,
};

const compactNumberStyle: React.CSSProperties = {
	width: 36,
	height: 22,
	border: "1px solid var(--border-default)",
	background: "var(--bg-input)",
	color: "var(--fg-primary)",
	borderRadius: 4,
	padding: "0 3px",
	fontSize: 11,
	textAlign: "center",
	fontFamily: "inherit",
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
