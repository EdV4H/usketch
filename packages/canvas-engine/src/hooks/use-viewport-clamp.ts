import { useEffect, useState } from "react";
import type { AnchorPosition } from "../types/shape-anchor.js";

const DEFAULT_EDGE_PADDING = 8;

export function useViewportClamp(
	anchorX: number,
	anchorY: number,
	overlayRef: React.RefObject<HTMLDivElement | null>,
	options?: { edgePadding?: number; position?: AnchorPosition },
): { left: number; top: number } {
	const pad = options?.edgePadding ?? DEFAULT_EDGE_PADDING;
	const position = options?.position ?? "bottom";
	const [dims, setDims] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const el = overlayRef.current;
		if (!el) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				setDims((prev) => {
					if (prev.width === width && prev.height === height) return prev;
					return { width, height };
				});
			}
		});

		observer.observe(el);

		// Initial measurement
		const rect = el.getBoundingClientRect();
		setDims({ width: rect.width, height: rect.height });

		return () => observer.disconnect();
	}, [overlayRef]);

	const { width, height } = dims;
	const vpW = typeof window !== "undefined" ? window.innerWidth : 0;
	const vpH = typeof window !== "undefined" ? window.innerHeight : 0;

	let left: number;
	let top: number;

	switch (position) {
		case "bottom":
			left = anchorX - width / 2;
			top = anchorY;
			break;
		case "top":
			left = anchorX - width / 2;
			top = anchorY - height;
			break;
		case "left":
			left = anchorX - width;
			top = anchorY - height / 2;
			break;
		case "right":
			left = anchorX;
			top = anchorY - height / 2;
			break;
	}

	// Clamp to viewport
	left = Math.max(pad, Math.min(left, vpW - width - pad));
	top = Math.max(pad, Math.min(top, vpH - height - pad));

	return { left, top };
}
