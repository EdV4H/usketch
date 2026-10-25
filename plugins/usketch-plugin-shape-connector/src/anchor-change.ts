import {
	type AnchorType,
	clampToShapeEdge,
	getAnchorPoint,
	getAnchorRatio,
	getPointFromAnchorRatio,
} from "@edv4h/usketch-connector-anchor";
import type { Point, ShapeData } from "@edv4h/usketch-shared";
import type { ConnectorShapeData } from "./types.js";

export interface AnchorChange {
	from: Partial<ConnectorShapeData>;
	to: Partial<ConnectorShapeData>;
}

function centerOf(shape: ShapeData): Point {
	return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/**
 * 端点 1 つの world 座標を求める。custom は比率があればそこから、なければ現在の端点を
 * shape の辺に寄せた位置（`getAnchorPoint` の custom は中心を返すので使わない）。
 */
function resolveEndpoint(
	shape: ShapeData,
	anchor: AnchorType,
	ratio: Point | undefined,
	point: Point | undefined,
	otherCenter: Point,
): Point {
	if (anchor !== "custom") return getAnchorPoint(shape, anchor, otherCenter);
	if (ratio) return getPointFromAnchorRatio(shape, ratio);
	return clampToShapeEdge(shape, point ?? centerOf(shape));
}

/**
 * HUD でコネクタの片端のアンカーを `value` に変えるときの差分（undo 用の from / to）。
 *
 * 両端が shape に接続していれば端点座標と bounds も計算し直す。片方でも未接続なら
 * アンカー（と custom の比率）だけを更新する。custom に切り替えたときは現在の端点を
 * 辺に寄せた位置を比率として保存する（既に custom で比率があればそれを保つ）。
 */
export function computeAnchorChange(
	connector: ConnectorShapeData,
	endpoint: "source" | "target",
	value: AnchorType,
	shapes: { source?: ShapeData; target?: ShapeData },
): AnchorChange {
	const anchorKey = endpoint === "source" ? "sourceAnchor" : "targetAnchor";
	const ratioKey = endpoint === "source" ? "sourceAnchorRatio" : "targetAnchorRatio";
	const pointKey = endpoint === "source" ? "sourcePoint" : "targetPoint";
	const shape = shapes[endpoint];

	// 切り替え後の比率。custom 以外では使わないので undefined のまま。
	let ratio: Point | undefined;
	if (value === "custom" && shape) {
		const keep = connector[anchorKey] === "custom" ? connector[ratioKey] : undefined;
		ratio =
			keep ??
			getAnchorRatio(shape, clampToShapeEdge(shape, connector[pointKey] ?? centerOf(shape)));
	}

	const from: Partial<ConnectorShapeData> = {
		[anchorKey]: connector[anchorKey],
		[ratioKey]: connector[ratioKey],
	};
	const to: Partial<ConnectorShapeData> = {
		[anchorKey]: value,
		...(ratio ? { [ratioKey]: ratio } : {}),
	};

	const { source, target } = shapes;
	if (!source || !target) return { from, to };

	const sourceAnchor = endpoint === "source" ? value : (connector.sourceAnchor ?? "auto");
	const targetAnchor = endpoint === "target" ? value : (connector.targetAnchor ?? "auto");
	const sourceRatio = endpoint === "source" ? ratio : connector.sourceAnchorRatio;
	const targetRatio = endpoint === "target" ? ratio : connector.targetAnchorRatio;
	const sp = resolveEndpoint(
		source,
		sourceAnchor,
		sourceRatio,
		connector.sourcePoint,
		centerOf(target),
	);
	const tp = resolveEndpoint(
		target,
		targetAnchor,
		targetRatio,
		connector.targetPoint,
		centerOf(source),
	);

	return {
		from: {
			...from,
			sourcePoint: connector.sourcePoint,
			targetPoint: connector.targetPoint,
			x: connector.x,
			y: connector.y,
			width: connector.width,
			height: connector.height,
		},
		to: {
			...to,
			sourcePoint: sp,
			targetPoint: tp,
			x: Math.min(sp.x, tp.x),
			y: Math.min(sp.y, tp.y),
			width: Math.abs(tp.x - sp.x),
			height: Math.abs(tp.y - sp.y),
		},
	};
}
