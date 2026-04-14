import { useEffect, useId, useRef, useState } from "react";
import { useAnchorStack, useAnchorStackOffset } from "../hooks/use-anchor-stack.js";
import { useShapeAnchorPosition } from "../hooks/use-shape-anchor-position.js";
import { useViewportClamp } from "../hooks/use-viewport-clamp.js";
import type { AnchorPosition, ShapeAnchorOptions } from "../types/shape-anchor.js";

export interface ShapeAnchorOverlayProps extends ShapeAnchorOptions {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

const DEFAULT_EDGE_PADDING = 8;

/** Check if the overlay fits at the given position without being clipped. */
function fitsAt(
	position: AnchorPosition,
	anchorX: number,
	anchorY: number,
	overlayW: number,
	overlayH: number,
	pad: number,
): boolean {
	const vpW = window.innerWidth;
	const vpH = window.innerHeight;
	switch (position) {
		case "top":
			return anchorY - overlayH >= pad;
		case "bottom":
			return anchorY + overlayH <= vpH - pad;
		case "left":
			return anchorX - overlayW >= pad;
		case "right":
			return anchorX + overlayW <= vpW - pad;
	}
}

export function ShapeAnchorOverlay({
	children,
	className,
	style,
	...anchorOptions
}: ShapeAnchorOverlayProps) {
	const overlayId = useId();
	const anchorResult = useShapeAnchorPosition(anchorOptions);
	const overlayRef = useRef<HTMLDivElement | null>(null);
	const registry = useAnchorStack();
	const gap = anchorOptions.gap ?? 48;
	const pad = anchorOptions.edgePadding ?? DEFAULT_EDGE_PADDING;

	// Track overlay dimensions
	const [dims, setDims] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const el = overlayRef.current;
		if (!el || !anchorResult.visible) {
			registry.unregister(overlayId);
			return;
		}

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

		const rect = el.getBoundingClientRect();
		setDims({ width: rect.width, height: rect.height });

		return () => {
			observer.disconnect();
			registry.unregister(overlayId);
		};
	}, [anchorResult.visible, registry, overlayId]);

	// Determine if primary position fits using actual overlay dimensions
	const primaryPosition = anchorResult.actualPosition;
	const primaryFits =
		dims.width === 0 && dims.height === 0
			? true // First render: assume fits, will re-evaluate after measurement
			: fitsAt(primaryPosition, anchorResult.x, anchorResult.y, dims.width, dims.height, pad);

	const useFallback = !primaryFits && anchorResult.fallbackPosition != null;
	const resolvedPosition = useFallback
		? (anchorResult.fallbackPosition as AnchorPosition)
		: primaryPosition;
	const resolvedX = useFallback ? anchorResult.fallbackX : anchorResult.x;
	const resolvedY = useFallback ? anchorResult.fallbackY : anchorResult.y;

	// Get stack offset — only fallback overlays get offset, non-fallback stay at base position
	const stackOffset = useAnchorStackOffset(registry, resolvedPosition, overlayId, useFallback, gap);

	// Apply stack offset
	let adjustedX = resolvedX;
	let adjustedY = resolvedY;
	if (resolvedPosition === "bottom") adjustedY += stackOffset;
	else if (resolvedPosition === "top") adjustedY -= stackOffset;
	else if (resolvedPosition === "right") adjustedX += stackOffset;
	else if (resolvedPosition === "left") adjustedX -= stackOffset;

	const clamped = useViewportClamp(adjustedX, adjustedY, overlayRef, {
		edgePadding: pad,
		position: resolvedPosition,
	});

	// Register slot with resolved position and fallback status
	useEffect(() => {
		if (!anchorResult.visible || (dims.width === 0 && dims.height === 0)) {
			registry.unregister(overlayId);
			return;
		}
		registry.register({
			id: overlayId,
			position: resolvedPosition,
			height: dims.height,
			width: dims.width,
			isFallback: useFallback,
		});
	}, [anchorResult.visible, dims, resolvedPosition, useFallback, registry, overlayId]);

	// Cleanup on unmount
	useEffect(() => {
		return () => registry.unregister(overlayId);
	}, [registry, overlayId]);

	if (!anchorResult.visible) return null;

	return (
		<div
			ref={overlayRef}
			className={className}
			style={{
				position: "absolute",
				left: clamped.left,
				top: clamped.top,
				pointerEvents: "auto",
				...style,
			}}
		>
			{children}
		</div>
	);
}
