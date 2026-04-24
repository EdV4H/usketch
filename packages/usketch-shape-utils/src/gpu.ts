import { cssColorToRgbaOrDefault, type GpuPrimitive, type ShapeData } from "@edv4h/usketch-shared";

export function rectGpuPrimitive(data: ShapeData): GpuPrimitive {
	return {
		kind: "rect",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		cornerRadius: (data as { cornerRadius?: number }).cornerRadius ?? 0,
		fill: cssColorToRgbaOrDefault(data.style.fill),
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
		rotation: data.rotation,
	};
}

export function roundedRectGpuPrimitive(data: ShapeData): GpuPrimitive {
	const cornerRadius = Math.min(data.width, data.height) / 4;
	return {
		kind: "rect",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		cornerRadius,
		fill: cssColorToRgbaOrDefault(data.style.fill),
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
		rotation: data.rotation,
	};
}

export function ellipseGpuPrimitive(data: ShapeData): GpuPrimitive {
	return {
		kind: "ellipse",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		fill: cssColorToRgbaOrDefault(data.style.fill),
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
		rotation: data.rotation,
	};
}

export function lineGpuPrimitive(data: ShapeData): GpuPrimitive {
	const vertices = new Float32Array([data.x, data.y, data.x + data.width, data.y + data.height]);
	return {
		kind: "polyline",
		bounds: { x: data.x, y: data.y, width: data.width, height: data.height },
		vertices,
		fill: [0, 0, 0, 0],
		stroke: cssColorToRgbaOrDefault(data.style.stroke),
		strokeWidth: data.style.strokeWidth,
		opacity: data.style.opacity,
	};
}
