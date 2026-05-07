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
 * Spot-check the stroke payload (first / middle / last) instead of walking the
 * full points array — shape plugins are trusted producers, and downstream
 * downsampling re-walks the kept slice.
 */
export function isRecognitionStroke(v: unknown): v is RecognitionStroke {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as { kind?: unknown; points?: unknown };
	if (obj.kind !== "stroke") return false;
	if (!Array.isArray(obj.points)) return false;
	const pts = obj.points;
	if (pts.length === 0) return true;
	const indices = pts.length === 1 ? [0] : [0, Math.floor(pts.length / 2), pts.length - 1];
	return indices.every((i) => isPoint(pts[i]));
}

export function isRecognitionImage(v: unknown): v is RecognitionImage {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as { kind?: unknown; src?: unknown };
	return obj.kind === "image" && typeof obj.src === "string";
}
