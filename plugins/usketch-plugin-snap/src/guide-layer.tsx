import { GUIDE_COLOR, GUIDE_DASH, GUIDE_STROKE_WIDTH } from "./constants.js";
import type { SnapLine } from "./engine/types.js";

interface GuideLayerProps {
	lines: SnapLine[];
}

function lineKey(line: SnapLine): string {
	return `${line.axis}-${line.position}-${line.from}-${line.to}`;
}

export function GuideLayer({ lines }: GuideLayerProps) {
	if (lines.length === 0) return null;

	return (
		<g>
			{lines.map((line) => {
				if (line.axis === "x") {
					return (
						<line
							key={lineKey(line)}
							x1={line.position}
							y1={line.from}
							x2={line.position}
							y2={line.to}
							stroke={GUIDE_COLOR}
							strokeWidth={GUIDE_STROKE_WIDTH}
							strokeDasharray={GUIDE_DASH}
							vectorEffect="non-scaling-stroke"
						/>
					);
				}
				return (
					<line
						key={lineKey(line)}
						x1={line.from}
						y1={line.position}
						x2={line.to}
						y2={line.position}
						stroke={GUIDE_COLOR}
						strokeWidth={GUIDE_STROKE_WIDTH}
						strokeDasharray={GUIDE_DASH}
						vectorEffect="non-scaling-stroke"
					/>
				);
			})}
		</g>
	);
}
