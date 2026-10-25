import type { Point, ResizeHandle, ShapeData } from "@edv4h/usketch-shared";

export function createResize(minW: number, minH: number) {
	return (data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData => {
		let { x, y, width, height } = data;
		switch (handle) {
			case "se":
				width += delta.x;
				height += delta.y;
				break;
			case "nw":
				x += delta.x;
				y += delta.y;
				width -= delta.x;
				height -= delta.y;
				break;
			case "ne":
				y += delta.y;
				width += delta.x;
				height -= delta.y;
				break;
			case "sw":
				x += delta.x;
				width -= delta.x;
				height += delta.y;
				break;
			case "e":
				width += delta.x;
				break;
			case "w":
				x += delta.x;
				width -= delta.x;
				break;
			case "n":
				y += delta.y;
				height -= delta.y;
				break;
			case "s":
				height += delta.y;
				break;
		}
		return {
			...data,
			x,
			y,
			width: Math.max(minW, width),
			height: Math.max(minH, height),
		};
	};
}

export interface AspectResizeOptions {
	/** Minimum width. Default `0`. */
	minWidth?: number;
	/** Minimum height (enforced by growing the width along the ratio). Default `0`. */
	minHeight?: number;
}

/**
 * Aspect-ratio-locked resize. `getAspect` returns width / height; a falsy
 * result falls back to the shape's current ratio (then `1`). Corner and e/w
 * handles drive the width, n/s drive the height; the opposite edge stays put
 * and the cross axis stays centered for edge handles. Min size is applied
 * along the ratio so clamping never distorts the shape.
 */
export function createAspectResize(
	getAspect: (data: ShapeData) => number,
	options: AspectResizeOptions = {},
) {
	const { minWidth = 0, minHeight = 0 } = options;
	return (data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData => {
		const aspect = getAspect(data) || data.width / data.height || 1;
		const usesVertical = handle === "n" || handle === "s";

		let width: number;
		if (usesVertical) {
			const dh = handle === "n" ? -delta.y : delta.y;
			width = (data.height + dh) * aspect;
		} else {
			const dw = handle.includes("w") ? -delta.x : delta.x;
			width = data.width + dw;
		}
		width = Math.max(width, minWidth, minHeight * aspect);
		const height = width / aspect;

		let x = data.x;
		let y = data.y;
		if (handle.includes("w")) x = data.x + (data.width - width);
		if (handle.includes("n")) y = data.y + (data.height - height);
		if (usesVertical) x = data.x + (data.width - width) / 2;
		if (handle === "e" || handle === "w") y = data.y + (data.height - height) / 2;

		return { ...data, x, y, width, height };
	};
}
