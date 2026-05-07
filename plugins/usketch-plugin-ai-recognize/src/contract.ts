/**
 * Recognition payload contracts owned by ai-recognize.
 *
 * Shape プラグインの `serializeForRecognition` は戻り値型を `unknown` で
 * 返すことになっており、ai-recognize 側がここで定義した type guard を使って
 * 形を確認する。これにより shape プラグインは ai-recognize ドメイン型を
 * import せずに済み、汎用→flavor 依存方向違反を避けられる。
 */

export interface RecognitionStroke {
	kind: "stroke";
	points: Array<{ x: number; y: number }>;
}

export interface RecognitionImage {
	kind: "image";
	src: string;
}

function isPoint(p: unknown): boolean {
	return (
		typeof p === "object" &&
		p !== null &&
		typeof (p as { x?: unknown }).x === "number" &&
		typeof (p as { y?: unknown }).y === "number"
	);
}

/**
 * Validates the stroke payload structurally. shape plugins are trusted producers,
 * so we only spot-check the points array (first / last / middle) instead of
 * walking the full O(n) array — recognition then downsamples to ≤ 80 points
 * and re-walks the kept slice, which catches malformed entries that slipped
 * through the spot-check.
 */
export function isRecognitionStroke(v: unknown): v is RecognitionStroke {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as { kind?: unknown; points?: unknown };
	if (obj.kind !== "stroke") return false;
	if (!Array.isArray(obj.points)) return false;
	const pts = obj.points;
	if (pts.length === 0) return true;
	// Spot-check: first, last, and middle. Cheap (O(1)) and catches plugins
	// that forgot the {x,y} shape entirely.
	const indices = pts.length === 1 ? [0] : [0, Math.floor(pts.length / 2), pts.length - 1];
	return indices.every((i) => isPoint(pts[i]));
}

export function isRecognitionImage(v: unknown): v is RecognitionImage {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as { kind?: unknown; src?: unknown };
	return obj.kind === "image" && typeof obj.src === "string";
}
