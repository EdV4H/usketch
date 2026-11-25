import {
	type DemoPageAccess,
	defaultPageAccess,
	defineDemoRules,
	type PageMemberRole,
	pageResource,
} from "@edv4h/usketch-demo-permissions";
import {
	type CaslPermissionProvider,
	createCaslPermissionProvider,
} from "@edv4h/usketch-permissions-casl";
import type { PageView } from "@edv4h/usketch-plugin-pages";
import { type PermissionProvider, scopePermissions } from "@edv4h/usketch-shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";

/**
 * ページごとの App に渡す権限を作る（ページを使わないボードは pageId が null）。`refresh` で
 * サーバーから読み直す（権限が変わったと届いたとき）。`view` はページパネルなどに渡す見え方
 * （見られないページを隠す・非公開ページの本当の名前）。読み直すたびに新しいオブジェクトになる。
 */
export type PagePermissions = ((pageId: string | null) => PermissionProvider) & {
	refresh(): void;
	view: PageView;
	access: PageAccessControl;
};

/** 招いた人の名前とメール。 */
export interface PagePerson {
	name: string;
	email: string;
}

/**
 * ページの公開範囲を読む・変える（公開範囲の HUD が使う）。変えるとサーバーから読み直す。
 * 変えられるのは、そのページを管理できる人だけ（サーバーが確かめる）。
 */
export interface PageAccessControl {
	/** ページの公開範囲。決めていないページは既定の扱いで、`isDefault` が true。 */
	get(pageId: string): { access: DemoPageAccess; isDefault: boolean };
	/** ボードが公開されているか（公開ページをログインしていない人も見られるか）。 */
	boardPublic(): boolean;
	/** 招いた人の名前とメール（分からなければ undefined）。 */
	person(userId: string): PagePerson | undefined;
	set(pageId: string, access: Pick<DemoPageAccess, "visibility" | "edit">): Promise<void>;
	invite(pageId: string, email: string, role: PageMemberRole): Promise<void>;
	remove(pageId: string, userId: string): Promise<void>;
	/** 読み直して変わったら知らせる。 */
	subscribe(listener: () => void): () => void;
}

/** 役割が分かるまでの答え: 今までどおり何でもできる（書き込みを止めるのはサーバー）。 */
const UNTIL_KNOWN = [{ action: "manage", subject: "all" }];

interface KnownAccess {
	boardPublic: boolean;
	pages: Record<string, DemoPageAccess>;
	names: Record<string, string>;
	hidden: ReadonlySet<string>;
	people: Record<string, PagePerson>;
}

/**
 * クラウドのボードの権限（デモのルールを CASL で）。ボードの役割とページの公開範囲を API から読み、
 * 読めたらルールを入れ替える（開いている App は読み取り専用などにすぐ切り替わる）。手元の
 * ボードは null（何でもできる）。サーバーも同じルールで判定する。
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
	// 公開ボードかどうかと、ページの公開範囲（行の無いページは既定の扱い）。
	const known = useRef<KnownAccess>({
		boardPublic: false,
		pages: {},
		names: {},
		hidden: new Set(),
		people: {},
	});
	// 読み直すたびに増やす（effect をもう一度走らせる）。
	const [generation, setGeneration] = useState(0);
	// 読み終えるたびに増やす（見え方が変わったことを画面に知らせる）。
	const [loaded, setLoaded] = useState(0);
	const viewListeners = useRef(new Set<() => void>());

	// biome-ignore lint/correctness/useExhaustiveDependencies: generation は読み直しの合図
	useEffect(() => {
		// ログインする前（セッションを読んでいる間も）は今のまま。未ログインの人はボードに
		// つながらないので、書いても手元だけ。
		if (!provider || !boardId || !userId) return;
		let cancelled = false;
		api.boards
			.pageAccess(boardId)
			.then((result) => {
				if (cancelled) return;
				known.current = {
					boardPublic: result.viewer.boardPublic,
					pages: result.pages,
					names: result.names ?? {},
					hidden: new Set(result.hidden),
					people: result.people ?? {},
				};
				// ルールが同じでも update はリスナーに知らせるので、公開範囲の変化も届く
				provider.update(defineDemoRules({ userId, boardRole: result.viewer.boardRole }));
				for (const listener of [...viewListeners.current]) listener();
				setLoaded((n) => n + 1);
			})
			.catch((e: unknown) => {
				// 読めなければ今のまま（サーバーが最後に止める）。
				if (!cancelled) console.warn("[permissions] Could not read the page access:", e);
			});
		return () => {
			cancelled = true;
		};
	}, [provider, boardId, userId, generation]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: loaded は読み終えた合図（新しいオブジェクトにする）
	return useMemo(() => {
		if (!provider || !boardId) return null;
		const refresh = () => setGeneration((g) => g + 1);
		const subscribe = (listener: () => void) => {
			viewListeners.current.add(listener);
			return () => {
				viewListeners.current.delete(listener);
			};
		};
		const view: PageView = {
			isVisible: (pageId) => !known.current.hidden.has(pageId),
			displayName: (page) => known.current.names[page.id],
			rename(pageId, name) {
				// 非公開ページの名前はルート doc で伏せているので、サーバーで変える
				if (known.current.pages[pageId]?.visibility !== "private") return false;
				known.current.names = { ...known.current.names, [pageId]: name };
				for (const listener of [...viewListeners.current]) listener();
				api.boards
					.renamePrivatePage(boardId, pageId, name)
					.catch((e: unknown) => {
						console.warn("[permissions] Could not rename the page:", e);
					})
					.finally(refresh);
				return true;
			},
			subscribe,
		};
		const access: PageAccessControl = {
			get(pageId) {
				const stored = known.current.pages[pageId];
				return stored
					? { access: stored, isDefault: false }
					: { access: defaultPageAccess(known.current.boardPublic), isDefault: true };
			},
			boardPublic: () => known.current.boardPublic,
			person: (userId) => known.current.people[userId],
			async set(pageId, next) {
				await api.boards.setPageAccess(boardId, pageId, next).finally(refresh);
			},
			async invite(pageId, email, role) {
				await api.boards.invitePageMember(boardId, pageId, { email, role }).finally(refresh);
			},
			async remove(pageId, userId) {
				await api.boards.removePageMember(boardId, pageId, userId).finally(refresh);
			},
			subscribe,
		};
		const forPage = (pageId: string | null) =>
			scopePermissions(provider, () =>
				pageResource(
					{ boardId, pageId },
					(pageId ? known.current.pages[pageId] : undefined) ??
						defaultPageAccess(known.current.boardPublic),
				),
			);
		return Object.assign(forPage, { refresh, view, access });
	}, [provider, boardId, loaded]);
}
