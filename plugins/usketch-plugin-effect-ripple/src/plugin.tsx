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
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-effect-ripple",
		name: "リップルエフェクト",

		setup(ctx: PluginContext) {
			injectStyle();

			ctx.transient.registerType("ripple", {
				render: (obj) => <RippleEffect obj={obj} />,
			});

			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind !== "ripple") return;

					// バリデーション
					const id = msg.id;
					const position = msg.position as Record<string, unknown> | undefined;
					if (
						typeof id !== "string" ||
						!position ||
						typeof position.x !== "number" ||
						typeof position.y !== "number"
					) {
						return;
					}

					ctx.transient.emit({
						id,
						type: "ripple",
						sourceUserId: typeof msg.sourceUserId === "string" ? msg.sourceUserId : "remote",
						position: { x: position.x, y: position.y },
						data: { color: typeof msg.color === "string" ? msg.color : "rgba(59, 130, 246, 0.5)" },
						ttl: typeof msg.ttl === "number" ? msg.ttl : RIPPLE_TTL,
						createdAt: Date.now(),
					});
				});
			}

			function onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
				const id = generateId();
				const color = "rgba(59, 130, 246, 0.5)";

				ctx.transient.emit({
					id,
					type: "ripple",
					sourceUserId: "local",
					position: event.worldPoint,
					data: { color },
					ttl: RIPPLE_TTL,
					createdAt: Date.now(),
				});

				wsProvider?.broadcast({
					kind: "ripple",
					id,
					sourceUserId: "local",
					position: event.worldPoint,
					color,
					ttl: RIPPLE_TTL,
				});
			}

			ctx.tools.register("effect-ripple", {
				icon: RippleIcon,
				cursor: "crosshair",
				shortcut: "r",
				order: 50,
				onPointerDown,
			});

			cleanup = () => {
				unsubBroadcast?.();
			};
		},

		teardown() {
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
