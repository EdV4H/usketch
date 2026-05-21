import {
	type BoundingBox,
	DEFAULT_STYLE,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { Renderer } from "@openuidev/react-lang";
import { getOpenUILibrary } from "./library-registry.js";
import type { OpenUIShapeData } from "./types.js";

function FallbackBox({ message }: { message: string }) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				background: "#fafafa",
				border: "1px dashed #d4d4d8",
				borderRadius: 6,
				color: "#71717a",
				fontFamily: "system-ui, -apple-system, sans-serif",
				fontSize: 13,
				textAlign: "center",
			}}
		>
			{message}
		</div>
	);
}

function render(shape: ShapeData) {
	const data = shape as OpenUIShapeData;
	const library = getOpenUILibrary();
	if (!library) {
		return (
			<FallbackBox message="OpenUI library not configured — install usketch-plugin-tool-openui" />
		);
	}
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				overflow: "auto",
				border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
				borderRadius: 6,
				background: data.style.fill,
				padding: 8,
				boxSizing: "border-box",
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			<Renderer
				response={data.langSource}
				library={library}
				isStreaming={false}
				onError={(err) => {
					console.warn("[usketch-plugin-shape-openui] Renderer error:", err);
				}}
			/>
		</div>
	);
}

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
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
	return { ...data, x, y, width: Math.max(160, width), height: Math.max(100, height) };
}

function createDefault(params: { id: string; x: number; y: number }): OpenUIShapeData {
	return {
		id: params.id,
		type: "openui",
		x: params.x,
		y: params.y,
		width: 480,
		height: 360,
		style: { ...DEFAULT_STYLE, fill: "#ffffff", stroke: "#e5e7eb", strokeWidth: 1 },
		langSource: "",
		prompt: "",
		model: "",
		libraryId: "openui-default",
	};
}

function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const data = shape as OpenUIShapeData;
	return {
		prompt: data.prompt,
		model: data.model,
		libraryId: data.libraryId,
		langLength: data.langSource.length,
		// langSource body intentionally omitted: it is too large for AI prompts
		// and re-feeding generated UI to other AI plugins risks self-referential
		// loops.
	};
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = shape as OpenUIShapeData;
	return {
		prompt: data.prompt,
		model: data.model,
		libraryId: data.libraryId,
		langLength: data.langSource.length,
	};
}

export const openUIShapePlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-openui",
	name: "OpenUI",

	setup(ctx: PluginContext) {
		ctx.shapes.register("openui", {
			render,
			getBounds,
			hitTest: withRotation(hitTest),
			resize,
			createDefault,
			renderTarget: "html",
			minSize: { width: 160, height: 100 },
			serializeForAi,
			debugFields,
		});
	},
};
