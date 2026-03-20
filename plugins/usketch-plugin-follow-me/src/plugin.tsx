import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

function FollowBanner({ name }: { name: string }) {
	return (
		<div
			style={{
				position: "absolute",
				top: 60,
				left: "50%",
				transform: "translateX(-50%)",
				background: "#0066ff",
				color: "#fff",
				padding: "6px 16px",
				borderRadius: 20,
				fontSize: 13,
				fontWeight: 600,
				fontFamily: "system-ui, sans-serif",
				boxShadow: "0 2px 8px rgba(0,102,255,0.3)",
				pointerEvents: "none",
				whiteSpace: "nowrap",
			}}
		>
			Following {name}
		</div>
	);
}

export interface FollowMePluginOptions {
	wsProvider: WsProviderHandle;
}

export function createFollowMePlugin(options: FollowMePluginOptions): UsketchPlugin {
	const { wsProvider } = options;
	const { awareness } = wsProvider;

	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-follow-me",
		name: "Follow Me",

		setup(ctx: PluginContext) {
			let followingClientId: number | null = null;
			let followingName = "";

			// バナーレイヤー
			ctx.layers.register({
				id: "follow-banner",
				order: 95,
				fixed: true,
				render: () => {
					if (followingClientId === null) return null;
					return <FollowBanner name={followingName} />;
				},
			});

			function onAwarenessChange() {
				const states = awareness.getStates();

				// フォロー中のプレゼンターが切断されたらフォロー解除
				if (followingClientId !== null && !states.has(followingClientId)) {
					followingClientId = null;
					followingName = "";
					return;
				}

				// フォロー中なら、プレゼンターのviewportに追従
				if (followingClientId !== null) {
					const presenterState = states.get(followingClientId);
					if (!presenterState) return;

					const vc = presenterState.viewportCenter as { x: number; y: number } | undefined;
					if (!vc || typeof vc.x !== "number" || typeof vc.y !== "number") return;

					// プレゼンターのビューポート中央に自分のビューポートを合わせる
					const viewport = ctx.store.getViewport();
					const screenCenterX = window.innerWidth / 2;
					const screenCenterY = window.innerHeight / 2;
					const newX = screenCenterX - vc.x * viewport.zoom;
					const newY = screenCenterY - vc.y * viewport.zoom;

					ctx.store.setViewport({ ...viewport, x: newX, y: newY });
				}
			}

			awareness.on("change", onAwarenessChange);

			// プレゼンテーション開始/停止ショートカット
			const unsubPresent = ctx.shortcuts.register("p", () => {
				const local = awareness.getLocalState();
				const isPresenting = local?.presenting === true;
				awareness.setLocalStateField("presenting", !isPresenting);
			});

			// フォローのトグル: プレゼンターをクリック or ショートカット
			const unsubFollow = ctx.shortcuts.register("f", () => {
				if (followingClientId !== null) {
					// フォロー解除
					followingClientId = null;
					followingName = "";
					return;
				}

				// プレゼンター中のユーザーを探す
				const states = awareness.getStates();
				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;
					if (state.presenting === true) {
						const user = state.user as { name?: string } | undefined;
						followingClientId = clientId;
						followingName = user?.name ?? "Unknown";
						return;
					}
				}
			});

			cleanup = () => {
				awareness.off("change", onAwarenessChange);
				unsubPresent();
				unsubFollow();
				ctx.layers.unregister("follow-banner");
				followingClientId = null;
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
