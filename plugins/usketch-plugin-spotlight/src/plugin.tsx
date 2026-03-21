import type {
	CanvasPointerEvent,
	PluginContext,
	ToolContext,
	TransientObject,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

const SPOTLIGHT_ID = "spotlight-active";

function SpotlightOverlay({ obj }: { obj: TransientObject }) {
	const cx = obj.position.x;
	const cy = obj.position.y;
	const radius = (obj.data.radius as number) || 150;

	return (
		<svg
			width="1"
			height="1"
			viewBox="0 0 1 1"
			style={{
				position: "absolute",
				left: -cx,
				top: -cy,
				width: "100vw",
				height: "100vh",
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			<defs>
				<mask id={`spotlight-mask-${obj.id}`}>
					<rect x="0" y="0" width="100%" height="100%" fill="white" />
					<circle cx={cx} cy={cy} r={radius} fill="black" />
				</mask>
			</defs>
			<rect
				x="0"
				y="0"
				width="100%"
				height="100%"
				fill="rgba(0,0,0,0.6)"
				mask={`url(#spotlight-mask-${obj.id})`}
			/>
		</svg>
	);
}

function SpotlightIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<title>Spotlight</title>
			<circle cx="10" cy="10" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<circle
				cx="10"
				cy="10"
				r="8"
				fill="none"
				stroke="currentColor"
				strokeWidth="0.5"
				opacity="0.4"
			/>
			<circle cx="10" cy="10" r="2" fill="currentColor" opacity="0.6" />
		</svg>
	);
}

function createPlugin(wsProvider?: WsProviderHandle): UsketchPlugin {
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-spotlight",
		name: "スポットライト",

		setup(ctx: PluginContext) {
			ctx.transient.registerType("spotlight", {
				render: (obj) => <SpotlightOverlay obj={obj} />,
			});

			let isActive = false;

			let unsubBroadcast: (() => void) | undefined;
			if (wsProvider) {
				unsubBroadcast = wsProvider.onBroadcast((msg) => {
					if (msg.kind === "spotlight-update") {
						const position = msg.position as Record<string, unknown> | undefined;
						if (!position || typeof position.x !== "number" || typeof position.y !== "number") {
							return;
						}
						ctx.transient.dismiss(SPOTLIGHT_ID);
						ctx.transient.emit({
							id: SPOTLIGHT_ID,
							type: "spotlight",
							sourceUserId: typeof msg.sourceUserId === "string" ? msg.sourceUserId : "remote",
							position: { x: position.x, y: position.y },
							data: { radius: typeof msg.radius === "number" ? msg.radius : 150 },
							createdAt: Date.now(),
						});
					} else if (msg.kind === "spotlight-dismiss") {
						ctx.transient.dismiss(SPOTLIGHT_ID);
					}
				});
			}

			function updateSpotlight(point: { x: number; y: number }) {
				ctx.transient.dismiss(SPOTLIGHT_ID);
				ctx.transient.emit({
					id: SPOTLIGHT_ID,
					type: "spotlight",
					sourceUserId: "local",
					position: point,
					data: { radius: 150 },
					createdAt: Date.now(),
				});

				wsProvider?.broadcast({
					kind: "spotlight-update",
					sourceUserId: "local",
					position: point,
					radius: 150,
				});
			}

			function dismissSpotlight() {
				ctx.transient.dismiss(SPOTLIGHT_ID);
				wsProvider?.broadcast({ kind: "spotlight-dismiss" });
			}

			const TOOL_ID = "spotlight";

			ctx.tools.register(TOOL_ID, {
				icon: SpotlightIcon,
				cursor: "crosshair",
				shortcut: "o",
				order: 70,
				onPointerDown: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					if (isActive) {
						// 2回目のクリックで解除してselectに戻る
						dismissSpotlight();
						isActive = false;
						ctx.store.setActiveToolId("select");
					} else {
						updateSpotlight(event.worldPoint);
						isActive = true;
					}
				},
				onPointerMove: (_toolCtx: ToolContext, event: CanvasPointerEvent) => {
					if (!isActive) return;
					updateSpotlight(event.worldPoint);
				},
			});

			// ツール切替でスポットライト解除
			let wasToolActive = ctx.store.getActiveToolId() === TOOL_ID;
			const unsubToolChange = ctx.store.subscribe(() => {
				const isToolActive = ctx.store.getActiveToolId() === TOOL_ID;
				if (!isToolActive && wasToolActive && isActive) {
					dismissSpotlight();
					isActive = false;
				}
				wasToolActive = isToolActive;
			});

			cleanup = () => {
				unsubBroadcast?.();
				unsubToolChange();
				ctx.transient.dismiss(SPOTLIGHT_ID);
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}

export function createSpotlightPlugin(wsProvider: WsProviderHandle): UsketchPlugin {
	return createPlugin(wsProvider);
}

export const spotlightPlugin: UsketchPlugin = createPlugin();
