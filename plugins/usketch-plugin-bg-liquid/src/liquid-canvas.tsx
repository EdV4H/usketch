import {
	cssColorToRgba,
	DEFAULT_THEME,
	type LayerRenderContext,
	screenToWorld,
	viewportRotation,
} from "@edv4h/usketch-shared";
import { type RefObject, useEffect, useRef } from "react";
import { collectObstacles } from "./displacer.js";
import { chooseCellSize, LiquidField } from "./liquid-field.js";
import { type Rgb, shadeLiquid } from "./liquid-shading.js";
import { type LiquidState, viscosityToRates } from "./liquid-state.js";

/** Target on-screen size of a simulation cell (CSS px); the bitmap is smoothed up. */
const CELL_SCREEN_PX = 7;
/** Simulate this many cells past the visible edge so rims don't pop in when panning. */
const WINDOW_MARGIN = 6;
/** Hard cap on simulated cells; past it the cell size doubles. */
const MAX_CELLS = 90_000;
/** Longest frame step simulated (s) — a backgrounded tab must not explode the step. */
const MAX_DT = 1 / 20;
/** Re-read the floor colour (theme can change at runtime) every N frames. */
const FLOOR_REFRESH_FRAMES = 60;

function toRgb(css: string | undefined | null): Rgb | null {
	if (!css) return null;
	const c = cssColorToRgba(css.trim());
	return c ? [c[0] * 255, c[1] * 255, c[2] * 255] : null;
}

/** World-space AABB of the screen box `[0,w]×[0,h]` (handles camera rotation). */
function visibleWorldBounds(vp: LayerRenderContext["viewport"], w: number, h: number) {
	const pts = [
		screenToWorld(0, 0, vp),
		screenToWorld(w, 0, vp),
		screenToWorld(0, h, vp),
		screenToWorld(w, h, vp),
	];
	const xs = pts.map((p) => p.x);
	const ys = pts.map((p) => p.y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Full-viewport `<canvas>` running the liquid simulation on rAF. Reads the latest
 * render context (viewport + shapes) from `renderCtx` every frame, so React only
 * mounts it once.
 */
export function LiquidCanvas({
	renderCtx,
	state,
}: {
	renderCtx: RefObject<LayerRenderContext>;
	state: LiquidState;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const g = canvas?.getContext("2d");
		if (!canvas || !g) return;
		const bitmap = document.createElement("canvas");
		const bg = bitmap.getContext("2d");
		if (!bg) return;

		const field = new LiquidField();
		let image: ImageData | null = null;
		let floor: Rgb = [245, 245, 245];
		let colorCss = "";
		let color: Rgb = [127, 157, 196];
		let frameNo = 0;
		let last = performance.now();
		const start = last;
		let raf = 0;

		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
			last = now;
			const rc = renderCtx.current;
			const w = canvas.clientWidth;
			const h = canvas.clientHeight;
			if (!rc || w <= 0 || h <= 0) return;

			const dpr = window.devicePixelRatio || 1;
			const pw = Math.round(w * dpr);
			const ph = Math.round(h * dpr);
			if (canvas.width !== pw || canvas.height !== ph) {
				canvas.width = pw;
				canvas.height = ph;
			}
			if (frameNo++ % FLOOR_REFRESH_FRAMES === 0) {
				floor =
					toRgb(getComputedStyle(canvas).getPropertyValue("--bg-canvas")) ??
					toRgb(rc.theme?.canvasBackground) ??
					(toRgb(DEFAULT_THEME.canvasBackground) as Rgb);
			}

			const settings = state.getSettings();
			if (settings.color !== colorCss) {
				colorCss = settings.color;
				color = toRgb(colorCss) ?? color;
			}

			// ── Simulate ──
			const vp = rc.viewport;
			const bounds = visibleWorldBounds(vp, w, h);
			let cell = chooseCellSize(vp.zoom, CELL_SCREEN_PX);
			while (
				(bounds.width / cell + 2 * WINDOW_MARGIN + 1) *
					(bounds.height / cell + 2 * WINDOW_MARGIN + 1) >
				MAX_CELLS
			) {
				cell *= 2;
			}
			field.setWindow(bounds, cell, WINDOW_MARGIN);
			field.applyObstacles(collectObstacles(rc.shapes.values(), settings.mode, bounds));
			field.step(dt, viscosityToRates(settings.viscosity));

			// ── Shade (one pixel per cell) and draw smoothed up to world size ──
			if (!image || image.width !== field.cols || image.height !== field.rows) {
				image = new ImageData(field.cols, field.rows);
				bitmap.width = field.cols;
				bitmap.height = field.rows;
			}
			shadeLiquid(field, image.data, {
				color,
				floor,
				flow: settings.flow,
				time: (now - start) / 1000,
			});
			bg.putImageData(image, 0, 0);

			g.setTransform(1, 0, 0, 1, 0, 0);
			g.fillStyle = `rgb(${floor[0]}, ${floor[1]}, ${floor[2]})`;
			g.fillRect(0, 0, pw, ph);
			// world → device px: scale(dpr) · translate(vp) · rotate · scale(zoom)
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
			g.translate(vp.x, vp.y);
			const rot = viewportRotation(vp);
			if (rot !== 0) g.rotate((rot * Math.PI) / 180);
			g.scale(vp.zoom, vp.zoom);
			g.imageSmoothingEnabled = true;
			g.imageSmoothingQuality = "high";
			g.drawImage(
				bitmap,
				field.col0 * cell,
				field.row0 * cell,
				field.cols * cell,
				field.rows * cell,
			);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	}, [renderCtx, state]);

	return (
		<canvas
			ref={canvasRef}
			style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
		/>
	);
}
