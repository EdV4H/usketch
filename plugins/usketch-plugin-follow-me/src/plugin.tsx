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

			function updateBanner() {
				ctx.layers.unregister("follow-banner");
				ctx.layers.register({
					id: "follow-banner",
					order: 95,
					fixed: true,
					render: () => {
						if (followingClientId === null) return null;
						return <FollowBanner name={followingName} />;
					},
				});
			}

			// バナーレイヤー初期登録
			updateBanner();

			function startFollow(clientId: number, name: string) {
				followingClientId = clientId;
				followingName = name;
				updateBanner();
			}

			function stopFollow() {
				followingClientId = null;
				followingName = "";
				updateBanner();
			}

			function onAwarenessChange() {
				const states = awareness.getStates();

				// フォロー中のユーザーが切断されたらフォロー解除
				if (followingClientId !== null && !states.has(followingClientId)) {
					stopFollow();
					return;
				}

				// フォロー中なら、対象のviewportに追従
				if (followingClientId !== null) {
					const targetState = states.get(followingClientId);
					if (!targetState) return;

					const vc = targetState.viewportCenter as { x: number; y: number } | undefined;
					if (!vc || typeof vc.x !== "number" || typeof vc.y !== "number") return;

					const viewport = ctx.store.getViewport();
					const screenCenterX = window.innerWidth / 2;
					const screenCenterY = window.innerHeight / 2;
					const newX = screenCenterX - vc.x * viewport.zoom;
					const newY = screenCenterY - vc.y * viewport.zoom;

					if (viewport.x !== newX || viewport.y !== newY) {
						ctx.store.setViewport({ ...viewport, x: newX, y: newY });
					}
				}
			}

			awareness.on("change", onAwarenessChange);

			// EventBus経由で任意のユーザーをフォロー
			const unsubFollowEvent = ctx.events.on<{ clientId: number; name: string }>(
				"follow:start",
				({ clientId, name }) => {
					startFollow(clientId, name);
				},
			);
			const unsubUnfollowEvent = ctx.events.on("follow:stop", () => {
				stopFollow();
			});

			// ショートカットf: プレゼンター優先、なければフォロー解除
			const unsubFollow = ctx.shortcuts.register("f", () => {
				if (followingClientId !== null) {
					stopFollow();
					return;
				}

				const states = awareness.getStates();
				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;
					if (state.presenting === true) {
						const user = state.user as { name?: string } | undefined;
						startFollow(clientId, user?.name ?? "Unknown");
						return;
					}
				}
			});

			cleanup = () => {
				awareness.off("change", onAwarenessChange);
				unsubFollow();
				unsubFollowEvent();
				unsubUnfollowEvent();
				ctx.layers.unregister("follow-banner");
				followingClientId = null;
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
