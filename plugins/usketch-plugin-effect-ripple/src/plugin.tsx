import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type ToolContext,
	type TransientObject,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

const RIPPLE_TTL = 600;
const RIPPLE_SIZE = 80;

function RippleEffect({ obj }: { obj: TransientObject }) {
	const color = (obj.data.color as string) ?? "rgba(59, 130, 246, 0.5)";

	return (
		<div
			style={{
				position: "absolute",
				left: -RIPPLE_SIZE / 2,
				top: -RIPPLE_SIZE / 2,
				width: RIPPLE_SIZE,
				height: RIPPLE_SIZE,
				borderRadius: "50%",
				border: `2px solid ${color}`,
				animation: `usketch-ripple ${RIPPLE_TTL}ms ease-out forwards`,
			}}
		/>
	);
}

function RippleIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Ripple</title>
			<circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<circle
				cx="10"
				cy="10"
				r="6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1"
				opacity="0.6"
			/>
			<circle
				cx="10"
				cy="10"
				r="9"
				fill="none"
				stroke="currentColor"
				strokeWidth="0.5"
				opacity="0.3"
			/>
		</svg>
	);
}

let styleInjected = false;
function injectStyle() {
	if (styleInjected) return;
	styleInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes usketch-ripple {
			0% { transform: scale(0); opacity: 1; }
			100% { transform: scale(2); opacity: 0; }
		}
	`;
	document.head.appendChild(style);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	return {
		id: "usketch-plugin-effect-ripple",
		name: "リップルエフェクト",

		setup(ctx: PluginContext) {
			injectStyle();

			ctx.transient.registerType("ripple", {
				render: (obj) => <RippleEffect obj={obj} />,
			});

			// リモートのリップルを受信して表示
			let unsubTransient: (() => void) | undefined;
			if (wsProvider) {
				unsubTransient = wsProvider.onTransient((msg) => {
					if (msg.type === "ripple") {
						ctx.transient.emit({
							id: msg.id,
							type: "ripple",
							sourceUserId: msg.sourceUserId,
							position: msg.position,
							data: msg.data,
							ttl: msg.ttl ?? RIPPLE_TTL,
							createdAt: Date.now(),
						});
					}
				});
			}

			function onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
				const obj = {
					id: generateId(),
					type: "ripple",
					sourceUserId: "local",
					position: event.worldPoint,
					data: { color: "rgba(59, 130, 246, 0.5)" },
					ttl: RIPPLE_TTL,
					createdAt: Date.now(),
				};

				ctx.transient.emit(obj);

				// リモートにもブロードキャスト
				wsProvider?.broadcastTransient({
					id: obj.id,
					type: obj.type,
					sourceUserId: obj.sourceUserId,
					position: obj.position,
					data: obj.data,
					ttl: obj.ttl,
				});
			}

			ctx.tools.register("effect-ripple", {
				icon: RippleIcon,
				cursor: "crosshair",
				shortcut: "r",
				order: 50,
				onPointerDown,
			});

			(this as unknown as Record<string, unknown>)._cleanup = () => {
				unsubTransient?.();
			};
		},

		teardown() {
			const cleanup = (this as unknown as Record<string, unknown>)._cleanup as
				| (() => void)
				| undefined;
			cleanup?.();
		},
	};
}

/** WsProvider付きファクトリ（リアルタイム同期対応） */
export function createRippleEffectPlugin(wsProvider: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}

/** ローカル専用（後方互換） */
export const rippleEffectPlugin: UsketchPlugin = createPlugin();
