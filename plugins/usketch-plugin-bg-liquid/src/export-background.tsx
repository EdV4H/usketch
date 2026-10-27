import type { LayerExportBackgroundContext } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";

/**
 * The liquid for a region export: a still surface (the live simulation is
 * per-viewer and animated, so the export shows the liquid at rest) — the body
 * colour with a soft sheen, in board coordinates.
 */
export function renderLiquidExportBackground(
	{ rect, idPrefix }: LayerExportBackgroundContext,
	color: string,
): ReactElement {
	const id = `${idPrefix}-sheen`;
	return (
		<g>
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
					<stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
					<stop offset="1" stopColor="#000000" stopOpacity={0.12} />
				</linearGradient>
			</defs>
			<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={color} />
			<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={`url(#${id})`} />
		</g>
	);
}
