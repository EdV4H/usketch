import type {
	CommandRegistry,
	LayerRenderContext,
	PluginContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { PresentModeOverlay } from "./present-mode-overlay.js";
import { SlideNavigator } from "./slide-navigator.js";
import { SlideOutlinePanel } from "./slide-outline-panel.js";

export type PresentationMode = "edit" | "present";

export interface PresentationPluginOptions {
	mode: PresentationMode;
}

function getWindowSize(): { width: number; height: number } {
	return { width: window.innerWidth, height: window.innerHeight };
}

export function createPresentationPlugin(opts: PresentationPluginOptions): UsketchPlugin {
	const mode = opts.mode;
	let nav: SlideNavigator | null = null;
	const unregisters: Array<() => void> = [];

	return {
		id: "presentation",
		name: "Presentation",
		setup(ctx: PluginContext) {
			nav = new SlideNavigator(ctx.store, getWindowSize);

			if (mode === "present") {
				const navRef = nav;
				unregisters.push(ctx.shortcuts.register("ArrowRight", () => navRef.next()));
				unregisters.push(ctx.shortcuts.register("ArrowLeft", () => navRef.prev()));
				unregisters.push(ctx.shortcuts.register("Home", () => navRef.first()));
				unregisters.push(ctx.shortcuts.register("End", () => navRef.last()));
				unregisters.push(
					ctx.shortcuts.register("Escape", () => {
						const url = new URL(window.location.href);
						url.searchParams.set("mode", "edit");
						window.history.replaceState(null, "", url.toString());
						// replaceState は popstate を発火させないので明示的に通知する
						window.dispatchEvent(new PopStateEvent("popstate"));
					}),
				);

				// Space キーは shortcut-registry のキー名正規化（trim）で扱えないため、
				// window 経由で直接ハンドリングする。PageDown / PageUp も同様に発表向けで受ける。
				const onKeyDown = (e: KeyboardEvent) => {
					const target = e.target as HTMLElement | null;
					if (target && (target.isContentEditable || /input|textarea/i.test(target.tagName)))
						return;
					if (e.ctrlKey || e.metaKey || e.altKey) return;
					if (e.key === " " || e.key === "PageDown") {
						e.preventDefault();
						navRef.next();
					} else if (e.key === "PageUp") {
						e.preventDefault();
						navRef.prev();
					}
				};
				window.addEventListener("keydown", onKeyDown);
				unregisters.push(() => window.removeEventListener("keydown", onKeyDown));

				// 初期表示: 最初のスライドに寄せる
				nav.first();
			}

			const layerId = "presentation-overlay";
			const commandsRef: CommandRegistry = ctx.commands;
			ctx.layers.register({
				id: layerId,
				order: mode === "present" ? 200 : 90,
				fixed: true,
				render: (renderCtx: LayerRenderContext) => {
					if (!nav) return null;
					return mode === "present" ? (
						<PresentModeOverlay nav={nav} />
					) : (
						<SlideOutlinePanel
							nav={nav}
							store={ctx.store}
							commands={commandsRef}
							renderCtx={renderCtx}
						/>
					);
				},
			});
			unregisters.push(() => ctx.layers.unregister(layerId));
		},
		teardown() {
			for (const u of unregisters) u();
			unregisters.length = 0;
			nav?.destroy();
			nav = null;
		},
	};
}
