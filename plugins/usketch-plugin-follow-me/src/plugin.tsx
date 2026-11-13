import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { centerOnWorld } from "@edv4h/usketch-shared";
import type { Awareness, WsProviderHandle } from "@edv4h/usketch-sync";

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

/** Display name of an awareness member (shared by the action label and its rebuild key). */
function memberName(state: Record<string, unknown>): string {
	const user = state.user as { name?: string } | undefined;
	return user?.name ?? "Unknown";
}

/** マルチページ: 別のページの人を追うときの設定。 */
export interface FollowMePagesOptions {
	/** ボード全員（どのページにいても）の awareness。各人の `page` を読む。 */
	awareness: Awareness;
	/** 今開いているページ。 */
	currentPageId: string;
	/** ページを切り替える（ホストが App を作り直す）。 */
	switchPage: (pageId: string) => void;
}

export interface FollowMePluginOptions {
	wsProvider: WsProviderHandle;
	/**
	 * マルチページ: 指定すると、別のページにいる人も一覧に出し、追っている人がページを
	 * 移ったら同じページへ移って追い続ける。
	 */
	pages?: FollowMePagesOptions;
}

/**
 * ページを切り替えると App ごと作り直すので、追っている人を次の App へ引き継ぐ
 * （同じタブの中だけ、少しの間だけ有効）。
 */
let carriedFollow: { clientId: number; name: string; at: number } | null = null;
const CARRY_MS = 15_000;

export function createFollowMePlugin(options: FollowMePluginOptions): UsketchPlugin {
	const { wsProvider, pages } = options;
	const awareness = pages?.awareness ?? wsProvider.awareness;
	/** その人が別のページにいれば、そのページ id。 */
	const otherPageOf = (state: Record<string, unknown> | undefined): string | null => {
		if (!pages || typeof state?.page !== "string") return null;
		return state.page === pages.currentPageId ? null : state.page;
	};

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
				// すぐに相手の位置へ（別のページにいれば、そのページを開く）
				onAwarenessChange();
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
			// 直近に登録した内容（フォロー状態 + メンバーの id・名前・presenting）。
			// awareness の "change" はリモートのカーソル移動やパンでも毎回発火するので、
			// 登録内容が変わらないときは unregister/register（と HUD への通知）を省く。
			let followActionsKey: string | null = null;
			const clearFollowActions = () => {
				for (const off of followActionOffs) off();
				followActionOffs = [];
				followActionsKey = null;
			};

			function followActionsKeyOf(states: ReturnType<typeof awareness.getStates>): string {
				let key = `${followingClientId ?? ""}\u0000${followingName}`;
				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;
					key += `\u0000${clientId}\u0001${memberName(state)}\u0001${state.presenting === true ? 1 : 0}\u0001${otherPageOf(state) ?? ""}`;
				}
				return key;
			}

			function rebuildFollowActions() {
				const states = awareness.getStates();
				const key = followActionsKeyOf(states);
				if (key === followActionsKey) return;
				clearFollowActions();
				followActionsKey = key;
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

				let order = 1;
				for (const [clientId, state] of states) {
					if (clientId === awareness.doc.clientID) continue;
					const name = memberName(state);
					const presenting = state.presenting === true;
					const elsewhere = otherPageOf(state) !== null;
					followActionOffs.push(
						ctx.actions.register({
							id: `follow:member:${clientId}`,
							label: `${presenting ? "📺 " : "👤 "}${name}${elsewhere ? "（別のページ）" : ""}`,
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

			// ページを移る前に追っていた人を引き継ぐ
			const carried = carriedFollow;
			carriedFollow = null;
			if (
				carried &&
				Date.now() - carried.at < CARRY_MS &&
				awareness.getStates().has(carried.clientId)
			) {
				startFollow(carried.clientId, carried.name);
			}

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

					// 別のページへ移ったら、同じページを開いて追い続ける
					const otherPage = otherPageOf(targetState);
					if (pages && otherPage) {
						carriedFollow = { clientId: followingClientId, name: followingName, at: Date.now() };
						pages.switchPage(otherPage);
						return;
					}

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
						startFollow(clientId, memberName(state));
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
