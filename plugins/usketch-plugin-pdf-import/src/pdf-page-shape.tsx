import type { AssetStore } from "@edv4h/usketch-plugin-asset-store";
import {
	type BoardStore,
	type BoundingBox,
	DEFAULT_STYLE,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ShapeDefinition,
	safeRotation,
	withRotation,
} from "@edv4h/usketch-shared";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type React from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
	containSize,
	getAnyCachedPage,
	isCancellation,
	renderPage,
	targetRenderWidth,
} from "./page-renderer.js";
import { acquireDocument, explainFailure, releaseDocument } from "./pdf-document.js";
import { PDF_PAGE_SHAPE_TYPE, type PdfPageShapeData } from "./types.js";

/** Wiring the shape needs but cannot reach from `render(data)` alone. */
export interface PdfPageShapeDeps {
	store: BoardStore;
	getAssets: () => AssetStore | undefined;
	maxRenderSize: number;
}

const PAGE_STYLE = {
	fill: "#ffffff",
	stroke: "#e0e0e0",
	strokeWidth: 1,
	opacity: 1,
} as const;

function devicePixelRatio(): number {
	return typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
}

/** Copy a finished render into the on-screen canvas in one paint. */
function blit(target: HTMLCanvasElement | null, source: HTMLCanvasElement): void {
	if (!target) return;
	if (target.width !== source.width || target.height !== source.height) {
		target.width = source.width;
		target.height = source.height;
	}
	const context = target.getContext("2d", { alpha: false });
	context?.drawImage(source, 0, 0);
}

function PdfPageView({ data, deps }: { data: PdfPageShapeData; deps: PdfPageShapeDeps }) {
	const { store, getAssets, maxRenderSize } = deps;
	const assets = getAssets();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
	const [painted, setPainted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Re-resolve when the asset store changes, so a page whose PDF arrives from
	// another client renders as soon as it lands.
	const subscribeAssets = useCallback(
		(cb: () => void) => assets?.subscribe(cb) ?? (() => undefined),
		[assets],
	);
	const src = useSyncExternalStore(subscribeAssets, () => assets?.resolve(data.assetId));

	// Shape components are memoized on shape identity, so zooming does not
	// re-render them — this subscription is what keeps the page sharp. The
	// snapshot is the quantized render width rather than the raw zoom, so a
	// pinch gesture produces a handful of re-renders instead of one per frame.
	const subscribeStore = useCallback((cb: () => void) => store.subscribe(cb), [store]);
	const renderWidth = useSyncExternalStore(subscribeStore, () =>
		targetRenderWidth(data.width, store.getViewport().zoom, devicePixelRatio(), maxRenderSize),
	);

	// Hold the shared document for as long as this page is mounted. Kept apart
	// from the render effect below so a zoom change re-renders without closing
	// and reopening the PDF.
	useEffect(() => {
		if (!src) return;
		const key = data.assetId;
		let active = true;
		acquireDocument(key, src).then(
			(loaded) => {
				if (active) setDocument(loaded);
			},
			(err: unknown) => {
				if (active) setError(explainFailure(err).message);
			},
		);
		return () => {
			active = false;
			setDocument(null);
			releaseDocument(key);
		};
	}, [src, data.assetId]);

	useEffect(() => {
		if (!document) return;
		const controller = new AbortController();

		// Show the last render we have while the correctly-sized one runs, so
		// zooming never blanks the page.
		const stale = getAnyCachedPage(data.assetId, data.pageNumber);
		if (stale) {
			blit(canvasRef.current, stale);
			setPainted(true);
		}

		renderPage({
			documentKey: data.assetId,
			document,
			pageNumber: data.pageNumber,
			width: renderWidth,
			signal: controller.signal,
		}).then(
			(rendered) => {
				if (controller.signal.aborted) return;
				blit(canvasRef.current, rendered);
				setPainted(true);
				setError(null);
			},
			(err: unknown) => {
				if (controller.signal.aborted || isCancellation(err)) return;
				setError(explainFailure(err).message);
			},
		);

		return () => controller.abort();
	}, [document, data.assetId, data.pageNumber, renderWidth]);

	const fit = containSize(data.width, data.height, data.pointWidth, data.pointHeight);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: data.style.fill,
				border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				overflow: "hidden",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<canvas
				ref={canvasRef}
				style={{
					width: fit.width,
					height: fit.height,
					display: "block",
					// Hidden rather than unmounted: the ref must exist for the
					// first blit, which happens before `painted` flips.
					visibility: painted ? "visible" : "hidden",
				}}
			/>
			{painted ? null : (
				<span
					style={{
						position: "absolute",
						color: "#999",
						fontSize: 13,
						fontFamily: "system-ui",
					}}
				>
					{error ?? `p.${data.pageNumber}`}
				</span>
			)}
		</div>
	);
}

/**
 * Style for the LOD stand-in. The renderer swaps out the positioned, rotated
 * wrapper in LOD mode, so the placeholder has to reproduce both itself —
 * matching `LodFallback` — or a rotated page would snap upright whenever it is
 * zoomed out or panned off-screen.
 */
export function simplifiedPageStyle(shape: ShapeData): React.CSSProperties {
	const rotation = safeRotation(shape.rotation);
	return {
		position: "absolute",
		left: shape.x,
		top: shape.y,
		width: shape.width,
		height: shape.height,
		background: shape.style.fill,
		border: `${shape.style.strokeWidth}px solid ${shape.style.stroke}`,
		pointerEvents: "none",
		transform: rotation ? `rotate(${rotation}deg)` : undefined,
		transformOrigin: "center center",
	};
}

/** Cheap stand-in used when zoomed out or off-screen. Positions itself. */
function SimplifiedPdfPage({ shape }: { shape: ShapeData }) {
	return <div style={simplifiedPageStyle(shape)} />;
}

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return { ...data, x, y, width: Math.max(40, width), height: Math.max(40, height) };
}

function createDefault(params: { id: string; x: number; y: number }): PdfPageShapeData {
	return {
		id: params.id,
		type: PDF_PAGE_SHAPE_TYPE,
		x: params.x,
		y: params.y,
		width: 339,
		height: 480,
		style: { ...DEFAULT_STYLE, ...PAGE_STYLE },
		assetId: "",
		pageNumber: 1,
		pageCount: 1,
		fileName: "",
		pointWidth: 595,
		pointHeight: 842,
	};
}

/**
 * Never expose the PDF bytes to a prompt — a page is described by where it came
 * from. Consumers needing pixels should render the page themselves.
 */
function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const data = shape as PdfPageShapeData;
	return { fileName: data.fileName, pageNumber: data.pageNumber, pageCount: data.pageCount };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = shape as PdfPageShapeData;
	return {
		assetId: data.assetId,
		page: `${data.pageNumber}/${data.pageCount}`,
		fileName: data.fileName,
		points: `${Math.round(data.pointWidth)}×${Math.round(data.pointHeight)}`,
	};
}

export function createPdfPageShapeDefinition(deps: PdfPageShapeDeps): ShapeDefinition {
	return {
		render: (shape) => <PdfPageView data={shape as PdfPageShapeData} deps={deps} />,
		getBounds,
		hitTest: withRotation(hitTest),
		resize,
		createDefault,
		renderTarget: "html",
		minSize: { width: 40, height: 40 },
		simplifiedComponent: SimplifiedPdfPage,
		serializeForAi,
		debugFields,
	};
}

export { PAGE_STYLE };
