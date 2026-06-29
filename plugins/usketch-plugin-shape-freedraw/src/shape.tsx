import {
	type BoundingBox,
	cssColorToRgbaOrDefault,
	DEFAULT_STYLE,
	type GpuPrimitive,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ShapeDefinition,
} from "@edv4h/usketch-shared";
import { brushOutlineD } from "./geometry/brush-outline.js";
import { eraserHits, hitStroke, maxHalfWidth, strokeBounds } from "./geometry/hit.js";
import { smoothPathD } from "./geometry/smooth-path.js";
import { penMeta } from "./pen-meta.js";
import type { FreedrawShapeData, StrokePoint } from "./types.js";

const asFreedraw = (shape: ShapeData): FreedrawShapeData => shape as FreedrawShapeData;

function render(shape: ShapeData) {
	const data = asFreedraw(shape);
	const pts = data.points ?? [];
	if (pts.length === 0) return <g />;

	const color = data.style.stroke;
	const size = data.style.strokeWidth;
	const opacity = data.style.opacity;
	const m = penMeta(data.pen);
	const blendStyle = m.blend === "multiply" ? ({ mixBlendMode: "multiply" } as const) : undefined;

	// 可変幅（筆ペン）: 塗りアウトライン
	if (m.variable) {
		return <path d={brushOutlineD(pts, size)} fill={color} opacity={opacity} style={blendStyle} />;
	}

	// 1点ストローク: 円
	if (pts.length === 1) {
		return (
			<circle
				cx={pts[0].x}
				cy={pts[0].y}
				r={size / 2}
				fill={color}
				opacity={opacity}
				style={blendStyle}
			/>
		);
	}

	// 一定幅: 中点二次ベジェの stroke パス
	return (
		<path
			d={smoothPathD(pts)}
			fill="none"
			stroke={color}
			strokeWidth={size}
			opacity={opacity}
			strokeLinecap="round"
			strokeLinejoin="round"
			style={blendStyle}
		/>
	);
}

function getBounds(shape: ShapeData): BoundingBox {
	return strokeBounds(asFreedraw(shape));
}

function hitTest(shape: ShapeData, point: Point): boolean {
	return hitStroke(asFreedraw(shape), point);
}

function mapPoints(
	points: StrokePoint[],
	fn: (p: StrokePoint) => { x: number; y: number },
): StrokePoint[] {
	return points.map((p) => ({ ...fn(p), p: p.p }));
}

function resize(shape: ShapeData, handle: ResizeHandle, delta: Point): FreedrawShapeData {
	const data = asFreedraw(shape);
	const points = data.points ?? [];
	const bounds = strokeBounds(data);
	if (bounds.width === 0 && bounds.height === 0) return data;

	let newX = bounds.x;
	let newY = bounds.y;
	let newWidth = bounds.width;
	let newHeight = bounds.height;

	switch (handle) {
		case "se":
			newWidth += delta.x;
			newHeight += delta.y;
			break;
		case "nw":
			newX += delta.x;
			newY += delta.y;
			newWidth -= delta.x;
			newHeight -= delta.y;
			break;
		case "ne":
			newY += delta.y;
			newWidth += delta.x;
			newHeight -= delta.y;
			break;
		case "sw":
			newX += delta.x;
			newWidth -= delta.x;
			newHeight += delta.y;
			break;
		case "e":
			newWidth += delta.x;
			break;
		case "w":
			newX += delta.x;
			newWidth -= delta.x;
			break;
		case "n":
			newY += delta.y;
			newHeight -= delta.y;
			break;
		case "s":
			newHeight += delta.y;
			break;
	}

	newWidth = Math.max(1, newWidth);
	newHeight = Math.max(1, newHeight);
	const scaleX = bounds.width !== 0 ? newWidth / bounds.width : 1;
	const scaleY = bounds.height !== 0 ? newHeight / bounds.height : 1;

	const newPoints = mapPoints(points, (p) => ({
		x: newX + (p.x - bounds.x) * scaleX,
		y: newY + (p.y - bounds.y) * scaleY,
	}));

	return { ...data, x: newX, y: newY, width: newWidth, height: newHeight, points: newPoints };
}

function move(shape: ShapeData, dx: number, dy: number): Partial<FreedrawShapeData> {
	const data = asFreedraw(shape);
	const points = data.points ?? [];
	return {
		x: data.x + dx,
		y: data.y + dy,
		points: mapPoints(points, (p) => ({ x: p.x + dx, y: p.y + dy })),
	};
}

function applyBounds(shape: ShapeData, newBounds: BoundingBox): Partial<FreedrawShapeData> {
	const data = asFreedraw(shape);
	const points = data.points ?? [];
	const oldBounds = strokeBounds(data);
	const scaleX = oldBounds.width !== 0 ? newBounds.width / oldBounds.width : 1;
	const scaleY = oldBounds.height !== 0 ? newBounds.height / oldBounds.height : 1;
	return {
		x: newBounds.x,
		y: newBounds.y,
		width: newBounds.width,
		height: newBounds.height,
		points: mapPoints(points, (p) => ({
			x: newBounds.x + (p.x - oldBounds.x) * scaleX,
			y: newBounds.y + (p.y - oldBounds.y) * scaleY,
		})),
	};
}

function createDefault(params: { id: string; x: number; y: number }): FreedrawShapeData {
	return {
		id: params.id,
		type: "freedraw",
		x: params.x,
		y: params.y,
		width: 0,
		height: 0,
		style: { ...DEFAULT_STYLE },
		points: [],
	};
}

function gpuPrimitive(shape: ShapeData): GpuPrimitive | null {
	const data = asFreedraw(shape);
	const m = penMeta(data.pen);
	// 可変幅・合成ペン（筆ペン/蛍光ペン）は DOM(SVG) で描く。
	if (m.variable || m.blend !== "normal") return null;
	const pts = data.points ?? [];
	if (pts.length < 2) return null;
	const verts = new Float32Array(pts.length * 2);
	for (let i = 0; i < pts.length; i++) {
		verts[i * 2] = pts[i].x;
		verts[i * 2 + 1] = pts[i].y;
	}
	return {
		kind: "polyline",
		bounds: getBounds(data),
		vertices: verts,
		fill: [0, 0, 0, 0],
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
	};
}

function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const data = asFreedraw(shape);
	return { pen: data.pen ?? "ballpoint", pointCount: (data.points ?? []).length };
}

function serializeForRecognition(shape: ShapeData): unknown {
	const data = asFreedraw(shape);
	const points = data.points ?? [];
	if (points.length < 2) return null;
	return { kind: "stroke", points };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = asFreedraw(shape);
	const points = data.points ?? [];
	return {
		pen: data.pen ?? "ballpoint",
		pointCount: points.length,
		firstPoint: points[0] ?? null,
		lastPoint: points[points.length - 1] ?? null,
	};
}

/** shape レジストリ用の定義。 */
export const freedrawShapeDefinition: ShapeDefinition = {
	render,
	getBounds,
	hitTest,
	resize,
	createDefault,
	move,
	applyBounds,
	gpuPrimitive,
	serializeForAi,
	serializeForRecognition,
	debugFields,
};

// 描画ツール/消しゴムから使う幾何ヘルパも再エクスポート。
export { eraserHits, maxHalfWidth, strokeBounds };
