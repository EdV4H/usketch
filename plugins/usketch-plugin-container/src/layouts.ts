import type { ShapeData } from "@edv4h/usketch-shared";

/** The shape of a `ShapeDefinition.container.layout` function. */
export type ContainerLayout = (ctx: {
	container: ShapeData;
	children: ShapeData[];
}) => Array<{ id: string; patch: Partial<ShapeData> }>;

export interface StackLayoutOptions {
	/** Inner padding on all sides (world units). Default 8. */
	padding?: number;
	/** Gap between adjacent children. Default 8. */
	gap?: number;
	/** Stacking direction. Default "vertical". */
	direction?: "vertical" | "horizontal";
}

/**
 * A simple single-axis stack: children are laid out top-to-bottom (vertical)
 * or left-to-right (horizontal), each stretched to the container's inner width
 * (vertical) or height (horizontal). Reads the children in their given order.
 *
 * A container opts in by setting `container.layout: stackLayout({ gap: 8 })`.
 */
export function stackLayout(options: StackLayoutOptions = {}): ContainerLayout {
	const { padding = 8, gap = 8, direction = "vertical" } = options;
	return ({ container, children }) => {
		const patches: Array<{ id: string; patch: Partial<ShapeData> }> = [];
		if (direction === "vertical") {
			// Clamp so a container narrower than 2×padding never yields a negative width.
			const width = Math.max(0, container.width - padding * 2);
			let y = container.y + padding;
			for (const child of children) {
				patches.push({
					id: child.id,
					patch: { x: container.x + padding, y, width },
				});
				y += child.height + gap;
			}
		} else {
			const height = Math.max(0, container.height - padding * 2);
			let x = container.x + padding;
			for (const child of children) {
				patches.push({
					id: child.id,
					patch: { x, y: container.y + padding, height },
				});
				x += child.width + gap;
			}
		}
		return patches;
	};
}

export interface GridLayoutOptions {
	/** Number of columns. Default 2. */
	columns?: number;
	/** Inner padding on all sides. Default 8. */
	padding?: number;
	/** Gap between cells (both axes). Default 8. */
	gap?: number;
}

/**
 * A fixed-column grid: children flow left-to-right, wrapping every `columns`.
 * Each cell is sized to an equal share of the container's inner width; the row
 * height follows the tallest child in that row.
 */
export function gridLayout(options: GridLayoutOptions = {}): ContainerLayout {
	const { columns = 2, padding = 8, gap = 8 } = options;
	// Guard against columns <= 0 (division by zero / Infinity) and negative cells.
	const cols = Math.max(1, Math.floor(columns));
	return ({ container, children }) => {
		const patches: Array<{ id: string; patch: Partial<ShapeData> }> = [];
		const innerWidth = container.width - padding * 2;
		const cellWidth = Math.max(0, (innerWidth - gap * (cols - 1)) / cols);
		let rowY = container.y + padding;
		let rowHeight = 0;
		children.forEach((child, i) => {
			const col = i % cols;
			if (col === 0 && i > 0) {
				rowY += rowHeight + gap;
				rowHeight = 0;
			}
			patches.push({
				id: child.id,
				patch: {
					x: container.x + padding + col * (cellWidth + gap),
					y: rowY,
					width: cellWidth,
				},
			});
			rowHeight = Math.max(rowHeight, child.height);
		});
		return patches;
	};
}
