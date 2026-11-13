import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type * as Y from "yjs";
import { watchMovedOutShapes } from "./page-transfer.js";
import { createPagesApi } from "./pages-api.js";
import type { OpenPageDoc } from "./pages-ops.js";
import { PagesPanel } from "./pages-panel.js";
import { pagesService } from "./pages-service.js";

export const PAGES_PLUGIN_ID = "usketch-plugin-pages";
const GROUP = "ページ";

export interface PagesPluginOptions {
	/** ルート doc（ページ一覧がある）。ボードを開いている間ずっと同じもの。 */
	rootDoc: Y.Doc;
	/** このプラグインを載せたページ（ページを切り替えるとホストが作り直す）。 */
	pageId: string;
	/** ページを切り替える（ホストが URL の `?page=` を変えて開き直す）。 */
	switchPage: (pageId: string) => void;
	/**
	 * ページ doc を開く（ホストの page-doc manager の `open`）。無ければ複製と、
	 * シェイプを別のページへ移す・コピーする操作を出さない。
	 */
	openPageDoc?: OpenPageDoc;
}

/**
 * マルチページ: HUD のページパネル（一覧・切り替え・追加・名前変更・並べ替え・複製・削除・復元）、
 * ページ操作のアクションとキー（Alt+PageDown / Alt+PageUp で次・前のページ）。
 * 操作は `getPagesApi(app.services)` と pages-ops.ts の純関数でも使える。
 */
export function createPagesPlugin(options: PagesPluginOptions): UsketchPlugin {
	return {
		id: PAGES_PLUGIN_ID,
		name: "ページ",

		setup(ctx) {
			const api = createPagesApi({
				root: options.rootDoc,
				currentPageId: options.pageId,
				switchPage: options.switchPage,
				openPageDoc: options.openPageDoc,
			});
			const hasNeighbor = (step: 1 | -1) => {
				const pages = api.list();
				const index = pages.findIndex((p) => p.id === api.currentPageId);
				return index >= 0 && pages[index + step] !== undefined;
			};

			const cleanups: Array<() => void> = [
				pagesService.provide(ctx.services, api),
				ctx.hud.registerPanel({
					id: `${PAGES_PLUGIN_ID}:panel`,
					title: "ページ",
					render: () => <PagesPanel api={api} store={ctx.store} />,
				}),
				ctx.actions.register({
					id: "pages:new",
					group: GROUP,
					label: "ページを追加",
					run: () => {
						api.create({ open: true });
					},
				}),
				ctx.actions.register({
					id: "pages:next",
					group: GROUP,
					label: "次のページ",
					isEnabled: () => hasNeighbor(1),
					run: () => {
						api.go(1);
					},
				}),
				ctx.actions.register({
					id: "pages:prev",
					group: GROUP,
					label: "前のページ",
					isEnabled: () => hasNeighbor(-1),
					run: () => {
						api.go(-1);
					},
				}),
			];
			if (api.canDuplicate) {
				cleanups.push(
					ctx.actions.register({
						id: "pages:duplicate",
						group: GROUP,
						label: "今のページを複製",
						run: async () => {
							await api.duplicate(api.currentPageId, { open: true });
						},
					}),
				);
			}

			// 別のページへ移したシェイプが同時編集で戻ってきたら消す（movedOut の印を見る）
			if (options.openPageDoc) {
				const handle = options.openPageDoc(options.pageId);
				let stopWatching: (() => void) | null = null;
				let disposed = false;
				void handle.whenLoaded.then(() => {
					if (!disposed) stopWatching = watchMovedOutShapes(handle.doc);
				});
				cleanups.push(() => {
					disposed = true;
					stopWatching?.();
					handle.release();
				});
			}

			// 発表モードの PageUp / PageDown と重ならないよう Alt を付ける
			const keymap = (ctx as Partial<PluginContext>).keymap;
			if (keymap) {
				cleanups.push(
					keymap.register({
						id: `${PAGES_PLUGIN_ID}:next`,
						keys: ["Alt+PageDown"],
						label: "次のページ",
						category: GROUP,
						order: 1,
						enabled: () => hasNeighbor(1),
						onPress: () => api.go(1),
					}),
					keymap.register({
						id: `${PAGES_PLUGIN_ID}:prev`,
						keys: ["Alt+PageUp"],
						label: "前のページ",
						category: GROUP,
						order: 2,
						enabled: () => hasNeighbor(-1),
						onPress: () => api.go(-1),
					}),
				);
			}

			return () => {
				for (const cleanup of cleanups) cleanup();
			};
		},
	};
}
