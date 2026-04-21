import type { SidePanelRegisterEvent } from "@edv4h/usketch-plugin-side-panel";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { CommentBadgeLayer } from "./comment-badge-layer.js";
import { createCommentClient } from "./comment-client.js";
import { CommentsTabWrapper } from "./comments-tab-wrapper.js";

function CommentIcon() {
	return (
		<svg
			width={13}
			height={13}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M2.5 7.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5-2.5 5-5.5 5c-.7 0-1.4-.1-2-.3L3 13.5l.8-2.4a4.8 4.8 0 0 1-1.3-3.6Z" />
		</svg>
	);
}

export interface CommentsPluginOptions {
	boardId: string;
	apiUrl: string;
	extraHeaders?: Record<string, string>;
}

export function createCommentsPlugin(options: CommentsPluginOptions): UsketchPlugin {
	const { boardId, apiUrl, extraHeaders } = options;
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-comments",
		name: "Comments",

		setup(ctx: PluginContext) {
			const client = createCommentClient({ apiUrl, boardId, extraHeaders });

			// サイドパネルにコメントタブ登録
			ctx.events.emit<SidePanelRegisterEvent>("side-panel:register-tab", {
				tab: {
					id: "comments",
					label: "コメント",
					icon: "💬",
					iconComponent: () => <CommentIcon />,
					order: 10,
					render: () => <CommentsTabWrapper client={client} events={ctx.events} />,
				},
			});

			// バッジレイヤー（fixedレイヤー = スクリーン座標系で描画）
			ctx.layers.register({
				id: "comment-badges",
				order: 55,
				fixed: true,
				render: (renderCtx) => (
					<CommentBadgeLayer
						ctx={renderCtx}
						store={ctx.store}
						shapes={ctx.shapes}
						events={ctx.events}
					/>
				),
			});

			// フローティングバーからのコメント開始イベント
			const unsubStartThread = ctx.events.on<{ selectedShapeIds: string[] }>(
				"comments:start-thread",
				({ selectedShapeIds }) => {
					if (selectedShapeIds.length === 0) return;
					const shapeId = selectedShapeIds[0];
					const shape = ctx.store.getShape(shapeId);
					if (!shape) return;

					// プロンプト入力なしで即サイドパネルを開いてスレッド作成準備
					ctx.events.emit("side-panel:open", { tabId: "comments" });
					ctx.events.emit("comments:prompt-new-thread", {
						anchorShapeId: shapeId,
						anchorX: shape.x,
						anchorY: shape.y,
					});
				},
			);

			cleanup = () => {
				unsubStartThread();
				ctx.events.emit("side-panel:unregister-tab", { tabId: "comments" });
				ctx.layers.unregister("comment-badges");
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
