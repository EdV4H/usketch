import type { AppInstance } from "@edv4h/usketch-core";
import type { HudStatusValue } from "@edv4h/usketch-shared";
import type { PageDocManager } from "@edv4h/usketch-sync";
import { useEffect } from "react";
import type * as Y from "yjs";
import { I } from "../components/ui/index.js";
import { localBoards } from "./local-boards.js";
import { collectPageCopy, copyPageToTryBoard } from "./try-board-copy.js";

/** 「手元で試す」の状態。 */
export type GuestTryState = "idle" | "copying" | "failed";

/** HUD の状態表示に出すもの（ログインしていない人だけ）。 */
export function guestTryStatus(state: GuestTryState, tryIt: () => void): HudStatusValue {
	if (state === "copying") return { text: "お試しボードへ写しています…", tone: "info" };
	if (state === "failed") {
		return {
			text: "お試しボードへ写せませんでした",
			tone: "danger",
			action: { label: "もう一度", run: tryIt },
		};
	}
	return {
		text: "見るだけです。ログインすると書き込めます",
		tone: "info",
		action: { label: "手元で試す", run: tryIt },
	};
}

/** ログイン画面の URL（ログインしたら今のページへ戻る）。 */
export function loginPath(location: { pathname: string; search: string }): string {
	return `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;
}

/**
 * ログインしていない人が公開ページを見ているとき、HUD に「見るだけ」の状態表示と
 * 「手元で試す」（今のページをお試しボードへ写して開く）・「ログイン」を出す。
 */
export function useGuestTry(options: {
	app: AppInstance | null;
	guest: boolean;
	board: { rootDoc: Y.Doc; pageDocs: PageDocManager } | null;
	pageId: string | null | undefined;
	/** 写し終えたら `/try?page=<id>` へ移る。 */
	navigate: (path: string) => void;
}): void {
	const { app, guest, board, pageId, navigate } = options;

	useEffect(() => {
		if (!app || !guest || !board || !pageId) return;
		let state: GuestTryState = "idle";
		let disposed = false;
		const listeners = new Set<() => void>();
		const setState = (next: GuestTryState) => {
			state = next;
			for (const listener of listeners) listener();
		};

		const tryIt = () => {
			if (state === "copying") return;
			setState("copying");
			const handle = board.pageDocs.open(pageId);
			void handle.whenLoaded
				.then(() => {
					const copy = collectPageCopy(board.rootDoc, handle.doc, pageId);
					if (!copy) throw new Error(`Page not found: ${pageId}`);
					return copyPageToTryBoard(localBoards.ensureTry().id, copy);
				})
				.then((copied) => {
					if (disposed) return;
					setState("idle");
					navigate(`/try?page=${encodeURIComponent(copied)}`);
				})
				.catch((e: unknown) => {
					console.error("[try] Could not copy the page:", e);
					if (!disposed) setState("failed");
				})
				.finally(() => handle.release());
		};

		const offStatus = app.hud.registerStatus?.({
			id: "usketch-web-guest:try",
			order: 10,
			get: () => guestTryStatus(state, tryIt),
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		});
		const offTry = app.actions.register({
			id: "guest:try",
			group: "アクション",
			label: "このページを手元で試す",
			icon: () => <I.play size={14} />,
			run: tryIt,
		});
		const offLogin = app.actions.register({
			id: "nav:login",
			group: "移動",
			label: "ログイン",
			icon: () => <I.users size={14} />,
			run: () => navigate(loginPath(window.location)),
		});
		return () => {
			disposed = true;
			offStatus?.();
			offTry();
			offLogin();
		};
	}, [app, guest, board, pageId, navigate]);
}
