import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { centerOnWorld } from "@edv4h/usketch-shared";
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
				rebuildFollowActions();
			}

			function stopFollow() {
				followingClientId = null;
				followingName = "";
				updateBanner();
				rebuildFollowActions();
			}

			// ── Follow controls (Control HUD "Follow" group) ──
			// Rebuilt on awareness change + follow-state change, mirroring the
			// per-item action pattern used by other plugins (e.g. timter): one
			// "follow" action per online member, plus an "Unfollow" toggle.
			let followActionOffs: (() => void)[] = [];
			const clearFollowActions = () => {
				for (const off of followActionOffs) off();
				followActionOffs = [];
			};

			function rebuildFollowActions() {
				clearFollowActions();
				followActionOffs.push(
					ctx.actions.register({
						id: "follow:unfollow",
						label: followingName ? `⏹ Unfollow ${followingName}` : "⏹ Unfollow",
						group: "Follow",
						order: 0,
						isEnabled: () => followingClientId !== null,
						run: () => stopFollow(),
					}),
				);

				const states = awareness.getStates();
				let order = 1;
				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;
					const user = state.user as { name?: string } | undefined;
					const name = user?.name ?? "Unknown";
					const presenting = state.presenting === true;
					followActionOffs.push(
						ctx.actions.register({
							id: `follow:member:${clientId}`,
							label: `${presenting ? "📺 " : "👤 "}${name}`,
							group: "Follow",
							order: order++,
							isActive: () => followingClientId === clientId,
							run: () => startFollow(clientId, name),
						}),
					);
				}
			}

			// Follow コントロール初期登録（let 初期化後に実行）
			rebuildFollowActions();

			function onAwarenessChange() {
				const states = awareness.getStates();

				// メンバーの増減を Follow コントロールへ反映。
				rebuildFollowActions();

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

					// Continuous follow → short tween so tracking stays responsive
					// (each retarget cancels the previous animation).
					centerOnWorld(ctx.store, vc, { durationMs: 180 });
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

			return () => {
				awareness.off("change", onAwarenessChange);
				unsubFollow();
				unsubFollowEvent();
				unsubUnfollowEvent();
				clearFollowActions();
				ctx.layers.unregister("follow-banner");
				followingClientId = null;
			};
		},
	};
}
