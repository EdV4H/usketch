import {
	type DemoBoardRole,
	defaultPageAccess,
	defineDemoRules,
	pageResource,
} from "@edv4h/usketch-demo-permissions";
import {
	type CaslPermissionProvider,
	createCaslPermissionProvider,
} from "@edv4h/usketch-permissions-casl";
import { type PermissionProvider, scopePermissions } from "@edv4h/usketch-shared";
import { useEffect, useMemo, useRef } from "react";
import { api } from "../lib/api.js";

/** ページごとの App に渡す権限を作る（ページを使わないボードは pageId が null）。 */
export type PagePermissions = (pageId: string | null) => PermissionProvider;

/** 役割が分かるまでの答え: 今までどおり何でもできる（書き込みを止めるのはサーバー）。 */
const UNTIL_KNOWN = [{ action: "manage", subject: "all" }];

function asBoardRole(role: string | null): DemoBoardRole | null {
	return role === "owner" || role === "editor" || role === "viewer" ? role : null;
}

/**
 * クラウドのボードの権限（デモのルールを CASL で）。ボードの役割と公開かどうかを API から読み、
 * 読めたらルールを入れ替える（開いている App は読み取り専用などにすぐ切り替わる）。手元の
 * ボードは null（何でもできる）。
 *
 * R4 でサーバーがルールを送るようになったら、ここはそれを `update` するだけになる。
 */
export function useBoardPermissions(options: {
	boardId: string | null;
	cloud: boolean;
	userId: string | null;
}): PagePermissions | null {
	const { boardId, cloud, userId } = options;
	const provider = useMemo<CaslPermissionProvider | null>(
		() => (boardId && cloud ? createCaslPermissionProvider({ rules: UNTIL_KNOWN }) : null),
		[boardId, cloud],
	);
	// 公開ボードかどうか（公開範囲を決めていないページの扱いに使う）。
	const boardPublic = useRef(false);

	useEffect(() => {
		// ログインする前（セッションを読んでいる間も）は今のまま。未ログインの人の扱いは R4 で
		// サーバーが決める（今はボードにつながらないので、書いても手元だけ）。
		if (!provider || !boardId || !userId) return;
		let cancelled = false;
		api.boards
			.get(boardId)
			.then((board) => {
				if (cancelled) return;
				boardPublic.current = board.isPublic;
				provider.update(defineDemoRules({ userId, boardRole: asBoardRole(board.role) }));
			})
			.catch((e: unknown) => {
				// 読めなければ今のまま（サーバーが最後に止める）。
				if (!cancelled) console.warn("[permissions] Could not read the board role:", e);
			});
		return () => {
			cancelled = true;
		};
	}, [provider, boardId, userId]);

	return useMemo(
		() =>
			provider && boardId
				? (pageId) =>
						scopePermissions(provider, () =>
							pageResource({ boardId, pageId }, defaultPageAccess(boardPublic.current)),
						)
				: null,
		[provider, boardId],
	);
}
