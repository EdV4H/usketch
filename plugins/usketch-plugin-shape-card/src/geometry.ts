import type { BoundingBox, Point, ResizeHandle, ShapeData } from "@edv4h/usketch-shared";

export function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

export function rectHitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

/** リサイズ時の最小幅（高さは aspect から導出）。 */
export const MIN_CARD_WIDTH = 60;

/**
 * `count` 個を `origin` から `stepX`/`stepY` 間隔で並べたグリッド座標を返す（純関数・回転なし）。
 * `cols` 列ごとに折り返すので、`cols = count` なら 1 行、`cols < count` なら複数行になる。
 * カードを場に整列展開する（Draw N / Spread deck）ときの配置に使う。
 */
export function gridPositions(
	count: number,
	opts: { cols: number; stepX: number; stepY: number; originX: number; originY: number },
): Point[] {
	const cols = Math.max(1, Math.floor(opts.cols));
	const positions: Point[] = [];
	for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
		const col = i % cols;
		const row = Math.floor(i / cols);
		positions.push({ x: opts.originX + col * opts.stepX, y: opts.originY + row * opts.stepY });
	}
	return positions;
}

/**
 * アスペクト比を固定したリサイズを生成する。比は shape の card-type から取得し、
 * 取れない場合は現在の縦横比にフォールバックする。ハンドルの反対側を固定する。
 */
export function makeAspectResize(getAspect: (data: ShapeData) => number) {
	return (data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData => {
		const aspect = getAspect(data) || data.width / data.height || 1;
		const usesVertical = handle === "n" || handle === "s";

		let width: number;
		let height: number;
		if (usesVertical) {
			const dh = handle === "n" ? -delta.y : delta.y;
			height = data.height + dh;
			width = height * aspect;
		} else {
			const dw = handle.includes("w") ? -delta.x : delta.x;
			width = data.width + dw;
			height = width / aspect;
		}

		const minW = MIN_CARD_WIDTH;
		const minH = minW / aspect;
		width = Math.max(minW, width);
		height = Math.max(minH, height);

		let x = data.x;
		let y = data.y;
		if (handle.includes("w")) x = data.x + (data.width - width);
		if (handle.includes("n")) y = data.y + (data.height - height);
		if (usesVertical) x = data.x + (data.width - width) / 2;
		if (handle === "e" || handle === "w") y = data.y + (data.height - height) / 2;

		return { ...data, x, y, width, height };
	};
}
