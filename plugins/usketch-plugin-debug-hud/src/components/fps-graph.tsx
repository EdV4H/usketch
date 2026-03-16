import { useCallback, useEffect, useRef } from "react";
import type { FpsCounter } from "../fps-counter.js";
import { FPS_GREEN, FPS_RED, FPS_YELLOW } from "../styles.js";

interface FpsGraphProps {
	fpsCounter: FpsCounter;
}

const WIDTH = 120;
const HEIGHT = 32;
const MAX_FPS = 80;

function colorForFps(fps: number): string {
	if (fps >= 50) return FPS_GREEN;
	if (fps >= 30) return FPS_YELLOW;
	return FPS_RED;
}

export function FpsGraph({ fpsCounter }: FpsGraphProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const history = fpsCounter.getHistory();
		ctx.clearRect(0, 0, WIDTH, HEIGHT);

		if (history.length < 2) return;

		// Draw 60fps reference line
		const y60 = HEIGHT - (60 / MAX_FPS) * HEIGHT;
		ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
		ctx.lineWidth = 1;
		ctx.setLineDash([2, 2]);
		ctx.beginPath();
		ctx.moveTo(0, y60);
		ctx.lineTo(WIDTH, y60);
		ctx.stroke();
		ctx.setLineDash([]);

		// Draw FPS line
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		const step = WIDTH / (60 - 1);
		const offset = (60 - history.length) * step;

		for (let i = 0; i < history.length; i++) {
			const x = offset + i * step;
			const y = HEIGHT - (Math.min(history[i], MAX_FPS) / MAX_FPS) * HEIGHT;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}

		const lastFps = history[history.length - 1];
		ctx.strokeStyle = colorForFps(lastFps);
		ctx.stroke();
	}, [fpsCounter]);

	useEffect(() => {
		const unsub = fpsCounter.subscribe(draw);
		draw();
		return unsub;
	}, [fpsCounter, draw]);

	return (
		<canvas
			ref={canvasRef}
			width={WIDTH}
			height={HEIGHT}
			style={{ width: WIDTH, height: HEIGHT, display: "block", marginTop: 2 }}
		/>
	);
}
