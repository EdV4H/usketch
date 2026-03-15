import type { LayerRenderContext, ShapeRegistry } from "@edv4h/usketch-shared";

export function SvgShapeLayer({
	ctx,
	shapeRegistry,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
}) {
	const shapes = [...ctx.shapes.values()].filter((shape) => {
		const def = shapeRegistry.get(shape.type);
		return def && def.renderTarget !== "html";
	});

	return (
		<g data-layer="shapes-svg">
			{shapes.map((shape) => {
				const def = shapeRegistry.get(shape.type);
				if (!def) return null;
				return <g key={shape.id}>{def.render(shape)}</g>;
			})}
		</g>
	);
}
