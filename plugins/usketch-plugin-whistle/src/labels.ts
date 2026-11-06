import type { WhistleKind } from "./kinds.js";

/** 画面に出す文言。host は i18n に合わせて差し替えられる。 */
export interface WhistleLabels {
	kindNames: Record<WhistleKind, string>;
	/** 名前が空のときの呼び名。 */
	someone: string;
	/** 集合のプロンプト。 */
	calling: (name: string) => string;
	/** 強制移動を受けられないときの全員集合・ついてきてのプロンプト。 */
	callingAll: (name: string) => string;
	invitingToFollow: (name: string) => string;
	move: string;
	follow: string;
	later: string;
	/** 全員集合のカウントダウン。 */
	assembling: (name: string) => string;
	stay: string;
	/** ついてきて (follower)。 */
	following: (name: string) => string;
	leave: string;
	/** ついてきて (leader)。 */
	leading: string;
	end: string;
	/** 吹いた直後のフィードバック。 */
	sent: (kindName: string) => string;
	/** クールダウン中で吹けなかったとき (残り秒数)。 */
	cooldown: (seconds: number) => string;
}

export const DEFAULT_WHISTLE_LABELS: WhistleLabels = {
	kindNames: {
		call: "おーい",
		gather: "集合",
		assemble: "全員集合",
		follow: "ついてきて",
	},
	someone: "だれか",
	calling: (name) => `${name}さんが呼んでいます`,
	callingAll: (name) => `${name}さんが全員を集めています`,
	invitingToFollow: (name) => `${name}さんが案内しています`,
	move: "移動する",
	follow: "ついていく",
	later: "あとで",
	assembling: (name) => `${name}さんが全員を集めています`,
	stay: "残る",
	following: (name) => `${name}さんについていっています`,
	leave: "離れる",
	leading: "みんなを案内しています",
	end: "終了",
	sent: (kindName) => `「${kindName}」を吹きました`,
	cooldown: (seconds) => `あと${seconds}秒で吹けます`,
};

/** host が差し替える文言 (kindNames も一部だけ渡せる)。 */
export type WhistleLabelOverrides = Partial<Omit<WhistleLabels, "kindNames">> & {
	kindNames?: Partial<Record<WhistleKind, string>>;
};

export function resolveLabels(overrides?: WhistleLabelOverrides): WhistleLabels {
	return {
		...DEFAULT_WHISTLE_LABELS,
		...overrides,
		kindNames: { ...DEFAULT_WHISTLE_LABELS.kindNames, ...overrides?.kindNames },
	};
}

const MAX_NAME_LENGTH = 25;

/** 長い名前を省略し、空なら someone にする。 */
export function displayName(name: string, labels: WhistleLabels): string {
	const trimmed = name.trim();
	if (!trimmed) return labels.someone;
	return trimmed.length <= MAX_NAME_LENGTH ? trimmed : `${trimmed.slice(0, MAX_NAME_LENGTH)}…`;
}
