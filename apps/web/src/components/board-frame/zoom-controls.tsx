import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { I, IconBtn } from "../ui/index.js";

/**
 * ズームイン / アウト / パーセンテージ / リセット。
 * `inline` のとき fixed ラッパーを外し、親レイアウト（TopBar 等）に埋め込む。
 */
export function ZoomControls({ inline = false }: { inline?: boolean } = {}) {
	const app = useApp();
	const viewport = useStoreSubscribe(app.store, (s) => s.getViewport());

	const zoomAt = (factor: number) => {
		const cx = window.innerWidth / 2;
		const cy = window.innerHeight / 2;
		app.store.zoomTo(viewport.zoom * factor, { x: cx, y: cy });
	};

	const reset = () => {
		app.store.setViewport({ x: 0, y: 0, zoom: 1 });
	};

	return (
		<div
			className={inline ? undefined : "u-surface"}
			style={
				inline
					? { display: "flex", alignItems: "center", gap: 1 }
					: {
							position: "fixed",
							bottom: 12,
							right: 12,
							zIndex: 20,
							padding: 3,
							borderRadius: 10,
							display: "flex",
							alignItems: "center",
							gap: 1,
						}
			}
		>
			<IconBtn icon={I.zoomOut} label="ズームアウト" onClick={() => zoomAt(0.8)} size={30} />
			<button
				type="button"
				onClick={reset}
				title="100% にリセット"
				style={{
					minWidth: 48,
					height: 30,
					padding: "0 6px",
					background: "transparent",
					border: "none",
					color: "var(--fg-secondary)",
					cursor: "pointer",
					fontSize: 11.5,
					fontWeight: 500,
					fontFamily: "var(--font-mono)",
					borderRadius: 6,
				}}
			>
				{Math.round(viewport.zoom * 100)}%
			</button>
			<IconBtn icon={I.zoomIn} label="ズームイン" onClick={() => zoomAt(1.25)} size={30} />
		</div>
	);
}
