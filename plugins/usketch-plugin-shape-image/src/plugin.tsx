import {
	type BoundingBox,
	DEFAULT_STYLE,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";

function render(data: ShapeData) {
	const src = data.src as string | undefined;
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: data.style.fill,
				border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
				borderRadius: 4,
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			{src ? (
				<img
					src={src}
					alt=""
					draggable={false}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "contain",
						pointerEvents: "none",
					}}
				/>
			) : (
				<span style={{ color: "#999", fontSize: 13, fontFamily: "system-ui" }}>No image</span>
			)}
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
	return { ...data, x, y, width: Math.max(40, width), height: Math.max(40, height) };
}

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "image",
		x: params.x,
		y: params.y,
		width: 200,
		height: 150,
		style: { ...DEFAULT_STYLE, fill: "#f5f5f5", strokeWidth: 1, stroke: "#e0e0e0" },
		src: "",
	};
}

export const imageShapePlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-image",
	name: "画像",

	setup(ctx: PluginContext) {
		ctx.shapes.register("image", {
			render,
			getBounds,
			hitTest,
			resize,
			createDefault,
			renderTarget: "html",
			minSize: { width: 40, height: 40 },
		});
	},
};
