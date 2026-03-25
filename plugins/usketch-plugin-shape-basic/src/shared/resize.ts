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
