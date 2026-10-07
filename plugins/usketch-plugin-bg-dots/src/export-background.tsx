import type { LayerExportBackgroundContext } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";

export const DOT_SPACING = 20;
export const DOT_RADIUS = 1;
export const DOT_COLOR = "#c0c0c0";
export const DOT_OPACITY = 0.6;

/**
 * The dots for a region export, in board coordinates. Spacing and radius both scale
 * with zoom on screen, so the dots are fully board-anchored (centered at
 * `DOT_SPACING·k + DOT_SPACING/2`) and `zoom` does not change the result.
 */
export function renderDotsExportBackground({
	rect,
	idPrefix,
}: LayerExportBackgroundContext): ReactElement {
	const id = `${idPrefix}-pattern`;
	return (
		<g>
			<defs>
				<pattern
					id={id}
					x={0}
					y={0}
					width={DOT_SPACING}
					height={DOT_SPACING}
					patternUnits="userSpaceOnUse"
				>
					<circle
						cx={DOT_SPACING / 2}
						cy={DOT_SPACING / 2}
						r={DOT_RADIUS}
						fill={DOT_COLOR}
						opacity={DOT_OPACITY}
					/>
				</pattern>
			</defs>
			<rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={`url(#${id})`} />
		</g>
	);
}
