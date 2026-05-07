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

export function isRecognitionStroke(v: unknown): v is RecognitionStroke {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as { kind?: unknown; points?: unknown };
	if (obj.kind !== "stroke") return false;
	if (!Array.isArray(obj.points)) return false;
	return obj.points.every(
		(p) =>
			typeof p === "object" &&
			p !== null &&
			typeof (p as { x?: unknown }).x === "number" &&
			typeof (p as { y?: unknown }).y === "number",
	);
}

export function isRecognitionImage(v: unknown): v is RecognitionImage {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as { kind?: unknown; src?: unknown };
	return obj.kind === "image" && typeof obj.src === "string";
}
