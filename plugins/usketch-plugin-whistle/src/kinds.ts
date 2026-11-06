// ホイッスルの種類と、受けた人がどう移動するか。
//
// - call     (おーい)     : 移動しない。吹いた場所に波紋、画面外なら方向バッジ (押せば移動)
// - gather   (集合)       : 承諾制。プロンプトの [移動する] で吹いた人の視界へ移動
// - assemble (全員集合)   : カウントダウン後に自動で吹いた人の視界へ移動 ([残る] で断れる)
// - follow   (ついてきて) : 吹いた人のカメラに追従し続ける (自分で操作すると外れる)

export const WHISTLE_KINDS = ["call", "gather", "assemble", "follow"] as const;

export type WhistleKind = (typeof WHISTLE_KINDS)[number];

/** 受けた人の移動の仕方。 */
export type WhistleMovement = "none" | "prompt" | "auto" | "follow";

export const WHISTLE_MOVEMENT: Record<WhistleKind, WhistleMovement> = {
	call: "none",
	gather: "prompt",
	assemble: "auto",
	follow: "follow",
};

export const DEFAULT_WHISTLE_KIND: WhistleKind = "call";

export function isWhistleKind(value: unknown): value is WhistleKind {
	return typeof value === "string" && (WHISTLE_KINDS as readonly string[]).includes(value);
}

/**
 * メッセージ上の kind を解釈する。kind を持たない旧バージョンのメッセージや
 * 未知の値は「おーい (call)」として扱う (古いクライアントとも混在できるように)。
 */
export function parseWhistleKind(value: unknown): WhistleKind {
	return isWhistleKind(value) ? value : DEFAULT_WHISTLE_KIND;
}

/** 「ついてきて」以外の種類。受け手の動き方を host が差し替えられる。 */
export type WhistleArrivalKind = Exclude<WhistleKind, "follow">;

/**
 * 種類ごとの受け手の動き方の差し替え (`none` / `prompt` / `auto`)。
 * 「ついてきて」は案内役が画角を送り続ける仕組みなので差し替えられない。
 */
export type WhistleMovementOverrides = Partial<
	Record<WhistleArrivalKind, Exclude<WhistleMovement, "follow">>
>;

/**
 * 実際に受け手へ適用する移動。強制移動 (auto / follow) を受けられない状態
 * (発表中・ドライブ中など、host が `canAutoMove` で false を返す) のときは
 * 承諾制 (prompt) に落とす。
 */
export function resolveMovement(
	kind: WhistleKind,
	canAutoMove: boolean,
	overrides?: WhistleMovementOverrides,
): WhistleMovement {
	const movement = (kind !== "follow" && overrides?.[kind]) || WHISTLE_MOVEMENT[kind];
	if (!canAutoMove && (movement === "auto" || movement === "follow")) return "prompt";
	return movement;
}
