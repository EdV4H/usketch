// ホイッスルのブロードキャストメッセージ (wsProvider.broadcast / onBroadcast)。
// 組み立てと検証を純関数にしておき、plugin 本体と host 側のブリッジの両方から使う。
import type { Point } from "@edv4h/usketch-shared";
import { parseWhistleKind, type WhistleKind } from "./kinds.js";

/** 吹いた瞬間のメッセージ。`whistleKind` を持たない旧メッセージは call 扱い。 */
export interface WhistleBlowMessage {
	kind: "whistle";
	id: string;
	whistleKind: WhistleKind;
	sourceUserId: string;
	sourceName: string;
	/** 吹いた人の画面中央 (world)。 */
	position: Point;
	/** 吹いた人のズーム。移動先のズームに使う (旧メッセージには無い)。 */
	zoom?: number;
}

/** ついてきて (follow) 中に、吹いた人のカメラを流すメッセージ。 */
export interface WhistleFollowMessage {
	kind: "whistle-follow";
	/** 元になった blow の id。 */
	id: string;
	sourceUserId: string;
	sourceName: string;
	/** 吹いた人の画面中央 (world)。 */
	center: Point;
	zoom: number;
	/**
	 * 送るたびに増える連番。画角が止まっていても生存確認 (heartbeat) として
	 * 同じ内容を送り直すので、状態ベースの中継 (awareness) でも変化として届くようにする。
	 */
	seq?: number;
}

/** ついてきて (follow) の終了。 */
export interface WhistleFollowEndMessage {
	kind: "whistle-follow-end";
	id: string;
}

export type WhistleMessage = WhistleBlowMessage | WhistleFollowMessage | WhistleFollowEndMessage;

export const WHISTLE_MESSAGE_KINDS = ["whistle", "whistle-follow", "whistle-follow-end"] as const;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const readPoint = (v: unknown): Point | null => {
	if (!v || typeof v !== "object") return null;
	const { x, y } = v as { x?: unknown; y?: unknown };
	return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : null;
};

const readZoom = (v: unknown): number | undefined => (isFiniteNumber(v) && v > 0 ? v : undefined);

const readString = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

/** 受信メッセージを検証して型付きにする。ホイッスル以外・壊れたものは null。 */
export function parseWhistleMessage(msg: Record<string, unknown>): WhistleMessage | null {
	const id = msg.id;
	if (typeof id !== "string" || id === "") return null;

	switch (msg.kind) {
		case "whistle": {
			const position = readPoint(msg.position);
			if (!position) return null;
			return {
				kind: "whistle",
				id,
				whistleKind: parseWhistleKind(msg.whistleKind),
				sourceUserId: readString(msg.sourceUserId, "remote"),
				sourceName: readString(msg.sourceName),
				position,
				zoom: readZoom(msg.zoom),
			};
		}
		case "whistle-follow": {
			const center = readPoint(msg.center);
			const zoom = readZoom(msg.zoom);
			if (!center || zoom === undefined) return null;
			return {
				kind: "whistle-follow",
				id,
				sourceUserId: readString(msg.sourceUserId, "remote"),
				sourceName: readString(msg.sourceName),
				center,
				zoom,
				seq: isFiniteNumber(msg.seq) ? msg.seq : undefined,
			};
		}
		case "whistle-follow-end":
			return { kind: "whistle-follow-end", id };
		default:
			return null;
	}
}
