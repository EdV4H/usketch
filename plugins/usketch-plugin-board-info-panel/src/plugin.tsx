import type { SidePanelRegisterEvent } from "@edv4h/usketch-plugin-side-panel";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardInfoClient } from "./board-info-client.js";
import { BoardInfoTabWrapper } from "./board-info-tab-wrapper.js";
import type { BoardPortalShapeData } from "./types.js";

export interface BoardInfoPanelPluginOptions {
	apiUrl: string;
	extraHeaders?: Record<string, string>;
	onOpenBoard: (boardId: string) => void;
}

export function createBoardInfoPanelPlugin(options: BoardInfoPanelPluginOptions): UsketchPlugin {
	const { apiUrl, extraHeaders, onOpenBoard } = options;
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-board-info-panel",
		name: "Board Info Panel",

		setup(ctx: PluginContext) {
			const client = createBoardInfoClient({ apiUrl, extraHeaders });

			// 選択中の board-portal の boardId を追跡
			let currentPortalBoardId: string | null = null;

			// サイドパネルにタブ登録
			ctx.events.emit<SidePanelRegisterEvent>("side-panel:register-tab", {
				tab: {
					id: "board-info",
					label: "Board",
					icon: "📋",
					order: 5,
					render: () => (
						<BoardInfoTabWrapper
							client={client}
							events={ctx.events}
							store={ctx.store}
							onOpenBoard={onOpenBoard}
							getBoardId={() => currentPortalBoardId}
						/>
					),
				},
			});

			// ポータルシェイプにサムネイル URL を設定（未設定の場合のみ）
			function ensureThumbnailUrl(shapeId: string, boardId: string) {
				const shape = ctx.store.getShape(shapeId) as BoardPortalShapeData | undefined;
				if (shape && !shape.thumbnailUrl && shape.isPublic !== false) {
					ctx.store.updateShape(shapeId, {
						thumbnailUrl: `${apiUrl}/public/boards/${boardId}/thumbnail?w=240&h=160`,
					} as Partial<BoardPortalShapeData>);
				}
			}

			function checkSelection() {
				const selection = ctx.store.getSelection();
				if (selection.size === 1) {
					const shapeId = [...selection][0];
					const shape = ctx.store.getShape(shapeId) as BoardPortalShapeData | undefined;
					if (shape && shape.type === "board-portal" && shape.boardId) {
						const boardId = shape.boardId;
						ensureThumbnailUrl(shapeId, boardId);
						if (boardId !== currentPortalBoardId) {
							currentPortalBoardId = boardId;
							ctx.events.emit("board-info:select", { boardId });
							ctx.events.emit("side-panel:open", { tabId: "board-info" });
						}
						return;
					}
				}
				if (currentPortalBoardId !== null) {
					currentPortalBoardId = null;
					ctx.events.emit("board-info:select", { boardId: null });
				}
			}

			const unsubMutation = ctx.store.onMutation(() => {
				checkSelection();
			});

			cleanup = () => {
				unsubMutation();
				ctx.events.emit("side-panel:unregister-tab", { tabId: "board-info" });
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
