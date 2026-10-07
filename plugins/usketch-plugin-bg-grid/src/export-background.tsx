import type { LayerExportBackgroundContext } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";

export const GRID_SIZE = 20;
export const GRID_COLOR = "#e0e0e0";
export const GRID_OPACITY = 0.5;

/**
 * The grid for a region export, in board coordinates. Spacing is GRID_SIZE board
 * units (zoom-independent, as on screen); only the line width depends on `zoom` —
 * the screen draws a 1px line, i.e. `1 / zoom` board units.
 */
export function renderGridExportBackground({
	rect,
	zoom,
	idPrefix,
}: LayerExportBackgroundContext): ReactElement {
	const id = `${idPrefix}-pattern`;
	const strokeWidth = zoom > 0 ? 1 / zoom : 1;
	return (
		<g>
			<defs>
				<pattern
					id={id}
					x={0}
					y={0}
					width={GRID_SIZE}
					height={GRID_SIZE}
					patternUnits="userSpaceOnUse"
				>
					<path
						d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
						fill="none"
						stroke={GRID_COLOR}
						strokeWidth={strokeWidth}
						opacity={GRID_OPACITY}
					/>
				</pattern>
			</defs>
			<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={`url(#${id})`} />
		</g>
	);
}
