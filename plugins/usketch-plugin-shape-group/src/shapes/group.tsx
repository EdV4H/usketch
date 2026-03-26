import type { BoundingBox, Point, ShapeData } from "@edv4h/usketch-shared";

export function renderGroup(_data: ShapeData) {
	// Groups are invisible — children are rendered individually
	return <g />;
}

export function getBoundsGroup(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

export function hitTestGroup(_data: ShapeData, _point: Point): boolean {
	// Groups delegate hit testing to children via the select tool
	return false;
}

export function resizeGroup(data: ShapeData, _handle: unknown, _delta: Point): ShapeData {
	// Group resize is handled by the select tool (proportional multi-resize)
	return { ...data };
}

export function createDefaultGroup(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "group",
		x: params.x,
		y: params.y,
		width: 0,
		height: 0,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
	};
}
