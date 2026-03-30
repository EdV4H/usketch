import type { ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";

export type ShapeMix = "rect" | "mixed";

const COLORS = [
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f59e0b",
	"#6366f1",
];

function randomColor(): string {
	return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function generateShapes(count: number, mix: ShapeMix): ShapeData[] {
	const shapes: ShapeData[] = [];

	// Grid layout: determine columns and rows
	const cols = Math.ceil(Math.sqrt(count * 1.5));
	const cellW = 120;
	const cellH = 100;

	for (let i = 0; i < count; i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const x = col * cellW + 10;
		const y = row * cellH + 10;
		const w = cellW - 20;
		const h = cellH - 20;

		let type: string;
		if (mix === "rect") {
			type = "rectangle";
		} else {
			const r = i % 10;
			if (r < 6) type = "rectangle";
			else if (r < 9) type = "ellipse";
			else type = "line";
		}

		const shape: ShapeData = {
			id: generateId(),
			type,
			x,
			y,
			width: w,
			height: h,
			style: {
				fill: type === "line" ? "transparent" : randomColor(),
				stroke: "#1e1e1e",
				strokeWidth: 2,
				opacity: 0.9,
			},
		};

		if (type === "rectangle") {
			shape.cornerRadius = 0;
		}

		shapes.push(shape);
	}

	return shapes;
}
