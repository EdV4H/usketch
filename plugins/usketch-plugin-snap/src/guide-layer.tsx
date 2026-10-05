import type { ReactNode } from "react";
import type { GuideStyle, SnapIndicator, SnapLine, SpacingGuide } from "./engine/types.js";

interface GuideLayerProps {
	lines: SnapLine[];
	gaps: SpacingGuide[];
	style: GuideStyle;
}

/** Half-length (screen px) of the perpendicular end tick on a spacing segment. */
const GAP_CAP = 4;

/**
 * Render one equal-spacing guide as tick-capped segments (all matching gaps at
 * once), so equal spacing reads at a glance. Solid lines distinguish these from
 * the dashed alignment lines.
 */
function renderSpacing(guide: SpacingGuide, keyBase: string, style: GuideStyle): ReactNode[] {
	const els: ReactNode[] = [];
	guide.segments.forEach((s, i) => {
		const k = `${keyBase}-seg${i}`;
		const cap = (x1: number, y1: number, x2: number, y2: number, ck: string) => (
			<line
				key={ck}
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke={style.color}
				strokeWidth={style.strokeWidth}
			/>
		);
		if (guide.axis === "x") {
			els.push(cap(s.start, s.cross, s.end, s.cross, `${k}-l`));
			els.push(cap(s.start, s.cross - GAP_CAP, s.start, s.cross + GAP_CAP, `${k}-c1`));
			els.push(cap(s.end, s.cross - GAP_CAP, s.end, s.cross + GAP_CAP, `${k}-c2`));
		} else {
			els.push(cap(s.cross, s.start, s.cross, s.end, `${k}-l`));
			els.push(cap(s.cross - GAP_CAP, s.start, s.cross + GAP_CAP, s.start, `${k}-c1`));
			els.push(cap(s.cross - GAP_CAP, s.end, s.cross + GAP_CAP, s.end, `${k}-c2`));
		}
	});
	return els;
}

function lineKey(line: SnapLine): string {
	return `${line.axis}-${line.position}-${line.from}-${line.to}`;
}

function renderIndicator(ind: SnapIndicator, key: string, style: GuideStyle) {
	if (ind.edge === "center") {
		const s = style.diamondSize;
		const d = `M${ind.x},${ind.y - s}L${ind.x + s},${ind.y}L${ind.x},${ind.y + s}L${ind.x - s},${ind.y}Z`;
		return <path key={key} d={d} fill={style.color} />;
	}
	return <circle key={key} cx={ind.x} cy={ind.y} r={style.indicatorRadius} fill={style.color} />;
}

export function GuideLayer({ lines, gaps, style }: GuideLayerProps) {
	if (lines.length === 0 && gaps.length === 0) return null;

	return (
		<g>
			{gaps.map((guide, i) => renderSpacing(guide, `gap-${i}`, style))}
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
