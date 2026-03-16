import {
	GUIDE_COLOR,
	GUIDE_DASH,
	GUIDE_STROKE_WIDTH,
	INDICATOR_DIAMOND_SIZE,
	INDICATOR_RADIUS,
} from "./constants.js";
import type { SnapIndicator, SnapLine } from "./engine/types.js";

interface GuideLayerProps {
	lines: SnapLine[];
}

function lineKey(line: SnapLine): string {
	return `${line.axis}-${line.position}-${line.from}-${line.to}`;
}

function renderIndicator(ind: SnapIndicator, key: string) {
	if (ind.edge === "center") {
		// Diamond for center snap
		const s = INDICATOR_DIAMOND_SIZE;
		const d = `M${ind.x},${ind.y - s}L${ind.x + s},${ind.y}L${ind.x},${ind.y + s}L${ind.x - s},${ind.y}Z`;
		return <path key={key} d={d} fill={GUIDE_COLOR} vectorEffect="non-scaling-stroke" />;
	}
	// Circle for edge snap
	return (
		<circle
			key={key}
			cx={ind.x}
			cy={ind.y}
			r={INDICATOR_RADIUS}
			fill={GUIDE_COLOR}
			vectorEffect="non-scaling-stroke"
		/>
	);
}

export function GuideLayer({ lines }: GuideLayerProps) {
	if (lines.length === 0) return null;

	return (
		<g>
			{lines.map((line) => {
				const key = lineKey(line);
				const elements = [];

				if (line.axis === "x") {
					elements.push(
						<line
							key={`${key}-line`}
							x1={line.position}
							y1={line.from}
							x2={line.position}
							y2={line.to}
							stroke={GUIDE_COLOR}
							strokeWidth={GUIDE_STROKE_WIDTH}
							strokeDasharray={GUIDE_DASH}
							vectorEffect="non-scaling-stroke"
						/>,
					);
				} else {
					elements.push(
						<line
							key={`${key}-line`}
							x1={line.from}
							y1={line.position}
							x2={line.to}
							y2={line.position}
							stroke={GUIDE_COLOR}
							strokeWidth={GUIDE_STROKE_WIDTH}
							strokeDasharray={GUIDE_DASH}
							vectorEffect="non-scaling-stroke"
						/>,
					);
				}

				for (let j = 0; j < line.indicators.length; j++) {
					elements.push(renderIndicator(line.indicators[j], `${key}-ind-${j}`));
				}

				return elements;
			})}
		</g>
	);
}
