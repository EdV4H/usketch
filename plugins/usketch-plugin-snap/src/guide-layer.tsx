import type { GuideStyle, SnapIndicator, SnapLine } from "./engine/types.js";

interface GuideLayerProps {
	lines: SnapLine[];
	style: GuideStyle;
}

function lineKey(line: SnapLine): string {
	return `${line.axis}-${line.position}-${line.from}-${line.to}`;
}

function renderIndicator(ind: SnapIndicator, key: string, style: GuideStyle) {
	if (ind.edge === "center") {
		const s = style.diamondSize;
		const d = `M${ind.x},${ind.y - s}L${ind.x + s},${ind.y}L${ind.x},${ind.y + s}L${ind.x - s},${ind.y}Z`;
		return <path key={key} d={d} fill={style.color} vectorEffect="non-scaling-stroke" />;
	}
	return (
		<circle
			key={key}
			cx={ind.x}
			cy={ind.y}
			r={style.indicatorRadius}
			fill={style.color}
			vectorEffect="non-scaling-stroke"
		/>
	);
}

export function GuideLayer({ lines, style }: GuideLayerProps) {
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
							stroke={style.color}
							strokeWidth={style.strokeWidth}
							strokeDasharray={style.dash}
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
							stroke={style.color}
							strokeWidth={style.strokeWidth}
							strokeDasharray={style.dash}
							vectorEffect="non-scaling-stroke"
						/>,
					);
				}

				for (let j = 0; j < line.indicators.length; j++) {
					elements.push(renderIndicator(line.indicators[j], `${key}-ind-${j}`, style));
				}

				return elements;
			})}
		</g>
	);
}
