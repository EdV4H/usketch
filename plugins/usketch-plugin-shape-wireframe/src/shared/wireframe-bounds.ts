import type { BoundingBox, Point, ResizeHandle, ShapeData } from "@edv4h/usketch-shared";

export function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

export function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

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
