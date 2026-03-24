import type { BoundingBox, ShapeData } from "@edv4h/usketch-shared";

export function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}
