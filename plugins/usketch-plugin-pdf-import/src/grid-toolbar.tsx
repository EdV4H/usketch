import { ShapeAnchorOverlay, useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import type { ShapeData } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import type React from "react";
import { useCallback } from "react";
import { clampColumns, detectColumns, reflowPages } from "./regrid.js";
import { PDF_PAGE_SHAPE_TYPE, type PdfPageShapeData } from "./types.js";

/** Screen-pixel gap between the pages' top edge and the bar. */
const TOOLBAR_GAP = 12;

function isPdfPage(shape: ShapeData | undefined): shape is PdfPageShapeData {
	return shape?.type === PDF_PAGE_SHAPE_TYPE;
}

/**
 * Floating control shown above a multi-page selection, letting the user change
 * how many pages sit in a row. Mounted as a `fixed` overlay layer rather than a
 * selection foreground, which is a single-winner slot already owned by the
 * select tool.
 */
export function PdfGridToolbar({ gap }: { gap: number }) {
	const app = useApp();
	const store = app.store;
	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const shapes = useStoreSubscribe(store, (s) => s.getShapes());

	const pages = [...selection].map((id) => shapes.get(id)).filter(isPdfPage);

	// A single page has no arrangement to speak of.
	if (pages.length < 2) return null;

	// Anchored to the top edge with no bottom fallback: `reflowPages` pins the
	// top edge and horizontal center, so the bar holds still across repeated
	// clicks. Falling back to the bottom edge would undo that — the bottom moves
	// whenever the row count changes, sliding the bar out from under the cursor.
	return (
		<ShapeAnchorOverlay shapeIds={pages.map((p) => p.id)} position="top" gap={TOOLBAR_GAP}>
			<GridControls pages={pages} gap={gap} />
		</ShapeAnchorOverlay>
	);
}

function GridControls({ pages, gap }: { pages: PdfPageShapeData[]; gap: number }) {
	const app = useApp();
	const store = app.store;
	const columns = detectColumns(pages);

	const setColumns = useCallback(
		(next: number) => {
			const target = clampColumns(next, pages.length);
			const patches = reflowPages(pages, target, gap);
			const updates = patches.flatMap((patch) => {
				const current = pages.find((p) => p.id === patch.id);
				if (!current || (current.x === patch.x && current.y === patch.y)) return [];
				return [
					{
						id: patch.id,
						from: { x: current.x, y: current.y },
						to: { x: patch.x, y: patch.y },
					},
				];
			});
			if (updates.length === 0) return;
			app.commands.execute(createBatchUpdateShapesCommand(store, updates));
		},
		[app.commands, store, pages, gap],
	);

	const atMin = columns <= 1;
	const atMax = columns >= pages.length;

	return (
		// Stop the canvas select tool from treating clicks on the bar as a
		// marquee drag that would clear the selection the bar depends on.
		<div onPointerDown={(e) => e.stopPropagation()} style={barStyle}>
			<span style={labelStyle}>列</span>
			<BarButton onClick={() => setColumns(columns - 1)} disabled={atMin} title="列を減らす">
				◀
			</BarButton>
			<span style={countStyle}>{columns}</span>
			<BarButton onClick={() => setColumns(columns + 1)} disabled={atMax} title="列を増やす">
				▶
			</BarButton>
			<span style={dividerStyle} />
			<BarButton
				onClick={() => setColumns(Math.ceil(Math.sqrt(pages.length)))}
				title="正方形に近い並びに戻す"
			>
				↺
			</BarButton>
			<span style={hintStyle}>{pages.length}ページ</span>
		</div>
	);
}

function BarButton({
	children,
	onClick,
	disabled,
	title,
}: {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	title: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={title}
			style={{
				...buttonStyle,
				opacity: disabled ? 0.35 : 1,
				cursor: disabled ? "default" : "pointer",
			}}
		>
			{children}
		</button>
	);
}

const barStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "4px 6px",
	background: "#fff",
	borderRadius: 8,
	boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
	fontFamily: "system-ui, sans-serif",
	fontSize: 11,
	whiteSpace: "nowrap",
	pointerEvents: "auto",
};

const buttonStyle: React.CSSProperties = {
	minWidth: 22,
	height: 22,
	padding: "0 4px",
	border: "1px solid #e0e0e0",
	borderRadius: 6,
	background: "#fff",
	fontSize: 11,
	lineHeight: 1,
	color: "#333",
};

const labelStyle: React.CSSProperties = { color: "#666", padding: "0 2px" };

const countStyle: React.CSSProperties = {
	minWidth: 16,
	textAlign: "center",
	fontVariantNumeric: "tabular-nums",
	fontWeight: 600,
	color: "#333",
};

const dividerStyle: React.CSSProperties = {
	width: 1,
	height: 16,
	background: "#e8e8e8",
	margin: "0 2px",
};

const hintStyle: React.CSSProperties = { color: "#999", padding: "0 2px" };
