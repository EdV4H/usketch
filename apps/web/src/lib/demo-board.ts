/**
 * デモボード（`/` で開くボード）。もとは Lobby のボードで、地域（Workshop・Gallery・Playground）は
 * このボードのページになった（#1558 R6。サーバーの `rooms/demo-import.ts`）。
 */
export const DEMO_BOARD_ID = "community-lobby";

/** 地域を取り込んだページの id（サーバーの `regionPageId` と同じ）。 */
export function regionPageId(slug: string): string {
	return `region-${slug}`;
}

/** もとの地域の URL（`/community/:slug`）の行き先。Lobby と知らない地域はデモボードの先頭。 */
export function regionRedirectPath(slug: string | undefined): string {
	if (!slug || slug === "lobby" || !/^[a-z0-9-]{1,40}$/.test(slug)) return "/";
	return `/?${new URLSearchParams({ page: regionPageId(slug) })}`;
}
