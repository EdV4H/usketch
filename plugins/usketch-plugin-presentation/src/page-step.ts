// 発表をページをまたいで進める。最後のスライドの次は次のページの先頭へ、最初のスライドの前は
// 前のページの最後へ。ページを切り替えるとホストはアプリを作り直すので、どこから始めるかを
// モジュールに預けて、次のページのプラグインが受け取る。
import type { SlideNavigator } from "./slide-navigator.js";

/** 発表をページをまたいで進めるためのホスト側の操作。 */
export interface PresentationPagesOptions {
	/** `step` 方向（1 = 次、-1 = 前）に隣のページがあるか。 */
	hasPage(step: 1 | -1): boolean;
	/** 隣のページへ切り替える。発表モード（URL の `?present=1&mode=present`）は保つこと。 */
	goToPage(step: 1 | -1): void;
	/** 発表の画面に出す今のページの名前（例: 「設計（2/3）」）。null なら出さない。 */
	pageLabel?: () => string | null;
}

/** 発表を始める位置。 */
export type PresentStart = "first" | "last";

/** 預けた開始位置の有効期限（ページの読み込みを待つ間）。 */
const CARRY_MS = 15_000;

let carried: { start: PresentStart; until: number } | null = null;

/** 次に作られる発表に、`start` から始めるよう預ける。 */
export function carryPresentStart(start: PresentStart, now: number = Date.now()): void {
	carried = { start, until: now + CARRY_MS };
}

/** 預けられた開始位置を受け取る（受け取ると消える）。無い・期限切れなら "first"。 */
export function takePresentStart(now: number = Date.now()): PresentStart {
	const value = carried && carried.until >= now ? carried.start : "first";
	carried = null;
	return value;
}

/** 発表の次（1）・前（-1）へ進めたときに起きること。 */
export type PresentStepResult = "slide" | "page" | "none";

/**
 * 発表を 1 つ進める・戻す。ページの中に進める先があればそこへ、無ければ隣のページへ
 * （前へ戻るときは前のページの最後から始めるよう預ける）。どちらも無ければ今のスライドに寄せ直す。
 */
export function stepPresentation(
	nav: SlideNavigator,
	step: 1 | -1,
	pages?: PresentationPagesOptions,
): PresentStepResult {
	const inPage = step === 1 ? nav.hasNext() : nav.hasPrev();
	if (inPage) {
		if (step === 1) nav.next();
		else nav.prev();
		return "slide";
	}
	if (pages?.hasPage(step)) {
		carryPresentStart(step === 1 ? "first" : "last");
		pages.goToPage(step);
		return "page";
	}
	if (step === 1) nav.next();
	else nav.prev();
	return "none";
}

/** 発表の次・前へ進める先があるか（ページの中か、隣のページ）。 */
export function canStepPresentation(
	nav: SlideNavigator,
	step: 1 | -1,
	pages?: PresentationPagesOptions,
): boolean {
	const inPage = step === 1 ? nav.hasNext() : nav.hasPrev();
	return inPage || (pages?.hasPage(step) ?? false);
}
