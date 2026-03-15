import type { LayerRenderContext, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";

function ShapeWrapper({
	shape,
	index,
	def,
}: {
	shape: ShapeData;
	index: number;
	def: { render: (data: ShapeData) => React.ReactElement; renderTarget?: string };
}) {
	const bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const isHtml = def.renderTarget === "html";

	return (
		<div
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: bounds.width,
				height: bounds.height,
				zIndex: index,
				pointerEvents: "auto",
			}}
		>
			{isHtml ? (
				def.render(shape)
			) : (
				<svg
					width={bounds.width}
					height={bounds.height}
					viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
					style={{ display: "block", overflow: "visible" }}
				>
					{def.render(shape)}
				</svg>
			)}
		</div>
	);
}

export function ShapeLayer({
	ctx,
	shapeRegistry,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
}) {
	const shapes = [...ctx.shapes.values()];

	return (
		<div data-layer="shapes">
			{shapes.map((shape, index) => {
				const def = shapeRegistry.get(shape.type);
				if (!def) return null;
				return <ShapeWrapper key={shape.id} shape={shape} index={index} def={def} />;
			})}
		</div>
	);
}
