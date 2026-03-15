import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type ToolContext,
	type TransientObject,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";

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

// Inject keyframes once
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

export const rippleEffectPlugin: UsketchPlugin = {
	id: "usketch-plugin-effect-ripple",
	name: "リップルエフェクト",

	setup(ctx: PluginContext) {
		injectStyle();

		ctx.transient.registerType("ripple", {
			render: (obj) => <RippleEffect obj={obj} />,
		});

		function onPointerDown(_toolCtx: ToolContext, event: CanvasPointerEvent) {
			ctx.transient.emit({
				id: generateId(),
				type: "ripple",
				sourceUserId: "local",
				position: event.worldPoint,
				data: { color: "rgba(59, 130, 246, 0.5)" },
				ttl: RIPPLE_TTL,
				createdAt: Date.now(),
			});
		}

		ctx.tools.register("effect-ripple", {
			icon: RippleIcon,
			cursor: "crosshair",
			shortcut: "r",
			order: 50,
			onPointerDown,
		});
	},
};
