import type { LayerRenderContext, ShapeRegistry } from "@edv4h/usketch-shared";

export function HtmlShapeLayer({
	ctx,
	shapeRegistry,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
}) {
	const shapes = [...ctx.shapes.values()].filter((shape) => {
		const def = shapeRegistry.get(shape.type);
		return def?.renderTarget === "html";
	});

	return (
		<div data-layer="shapes-html">
			{shapes.map((shape) => {
				const def = shapeRegistry.get(shape.type);
				if (!def) return null;
				return (
					<div
						key={shape.id}
						style={{
							position: "absolute",
							left: shape.x,
							top: shape.y,
							width: shape.width,
							height: shape.height,
							pointerEvents: "auto",
						}}
					>
						{def.render(shape)}
					</div>
				);
			})}
		</div>
	);
}
