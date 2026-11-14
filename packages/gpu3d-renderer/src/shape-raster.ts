// Shape pictures for the GPU 3D view: a shape's drawing as an image, to be laid on the
// ground as a texture. A shape the DOM layer draws is copied from its node (its computed
// styles inlined into an SVG `foreignObject`); a shape the 2D GPU renderer draws instead
// (no DOM node) is drawn from its `gpuPrimitive` on a 2D canvas.
//
// Limits of the `foreignObject` copy (the SVG is loaded as an image, which can't fetch):
// web fonts fall back to local ones. An image is copied in as a `data:` URL when the page
// can read its pixels (loaded, and same-origin or CORS-enabled); others are left out.
import type { GpuPrimitive, ShapeData } from "@edv4h/usketch-shared";

/** Longest side of a shape picture, device px. */
export const MAX_PICTURE_PX = 2048;
/**
 * World units a picture reaches past the shape's box on each side: what a shape draws
 * just outside it (half of an edge's stroke, a shadow).
 */
export const PICTURE_PAD = 8;

/**
 * Picture px per world unit for a view zoom and pixel ratio: twice the screen's, as a
 * power of two (so a little zooming re-uses the pictures), between 1/4 and 4, and small enough that the longest side
 * of a `width` × `height` shape stays within {@link MAX_PICTURE_PX}. Pure.
 */
export function pictureScale(
	zoom: number,
	pixelRatio: number,
	width: number,
	height: number,
): number {
	// Twice the screen's px: the ground is seen at a slant, which squeezes the picture.
	const want =
		2 * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1) * (pixelRatio > 0 ? pixelRatio : 1);
	let s = 2 ** Math.ceil(Math.log2(Math.min(4, Math.max(0.25, want))));
	const side = Math.max(width, height, 1) + 2 * PICTURE_PAD;
	while (s > 1 / 64 && side * s > MAX_PICTURE_PX) s /= 2;
	return s;
}

/** Computed styles left out of the copy (they place the node on the board, or hide it there). */
const SKIPPED = new Set(["visibility", "pointer-events", "cursor", "transition", "animation"]);
/** Styles of the copied root that would move it inside the picture. */
const ROOT_RESET: Record<string, string> = {
	position: "relative",
	left: "0px",
	top: "0px",
	right: "auto",
	bottom: "auto",
	margin: "0px",
	transform: "none",
	"z-index": "auto",
};

function copyStyles(from: Element, to: Element): void {
	const cs = getComputedStyle(from);
	const out: string[] = [];
	for (let i = 0; i < cs.length; i++) {
		const name = cs[i];
		if (SKIPPED.has(name) || name.startsWith("transition") || name.startsWith("animation"))
			continue;
		const value = cs.getPropertyValue(name);
		if (value) out.push(`${name}:${value}`);
	}
	to.setAttribute("style", out.join(";"));
	const fromKids = from.children;
	const toKids = to.children;
	for (let i = 0; i < fromKids.length && i < toKids.length; i++) copyStyles(fromKids[i], toKids[i]);
}

/**
 * The SVG markup of a DOM node's drawing at `scale` picture px per CSS px, `width` ×
 * `height` CSS px, with {@link PICTURE_PAD} around it. Needs a document (computed styles).
 */
export function nodePictureSvg(
	node: Element,
	width: number,
	height: number,
	scale: number,
): string {
	const clone = node.cloneNode(true) as Element;
	copyStyles(node, clone);
	if (clone instanceof HTMLElement || clone instanceof SVGElement) {
		for (const [k, v] of Object.entries(ROOT_RESET)) clone.style.setProperty(k, v);
	}
	// Nothing can load inside an SVG image: copy the pictures in, leave the rest out.
	inlineImages(node, clone);
	for (const el of clone.querySelectorAll("image, video, iframe, canvas")) el.remove();
	const wrap = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
	wrap.setAttribute(
		"style",
		`width:${width}px;height:${height}px;padding:${PICTURE_PAD}px;` +
			`transform:scale(${scale});transform-origin:0 0;`,
	);
	wrap.appendChild(clone);
	const xml = new XMLSerializer().serializeToString(wrap);
	const pw = Math.max(1, Math.ceil((width + 2 * PICTURE_PAD) * scale));
	const ph = Math.max(1, Math.ceil((height + 2 * PICTURE_PAD) * scale));
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">` +
		`<foreignObject x="0" y="0" width="${pw}" height="${ph}">${xml}</foreignObject></svg>`
	);
}

/**
 * Each `<img>` of `clone` (a deep copy of `node`) as a `data:` URL of what `node`'s image
 * shows: kept as is when it already is one, drawn through a canvas when its pixels can be
 * read, otherwise removed.
 */
function inlineImages(node: Element, clone: Element): void {
	const from = node.querySelectorAll("img");
	const to = clone.querySelectorAll("img");
	for (let i = 0; i < to.length; i++) {
		const copy = to[i];
		copy.removeAttribute("srcset");
		const url = imageDataUrl(from[i]);
		if (url) copy.setAttribute("src", url);
		else copy.remove();
	}
}

/** What an image shows, as a `data:` URL, or `null` when it can't be read. */
export function imageDataUrl(img: HTMLImageElement | undefined): string | null {
	if (!img) return null;
	const src = img.currentSrc || img.src || "";
	if (src.startsWith("data:")) return src;
	if (!img.complete || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return null;
	try {
		const s = Math.min(1, MAX_PICTURE_PX / Math.max(img.naturalWidth, img.naturalHeight));
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(img.naturalWidth * s));
		canvas.height = Math.max(1, Math.round(img.naturalHeight * s));
		const g = canvas.getContext("2d");
		if (!g) return null;
		g.drawImage(img, 0, 0, canvas.width, canvas.height);
		// Throws on an image from another origin without CORS (a tainted canvas).
		return canvas.toDataURL("image/png");
	} catch {
		return null;
	}
}

/** Loads SVG markup as an image (rejects when it can't be decoded). */
export async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
	const img = new Image();
	img.decoding = "async";
	img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	await img.decode();
	return img;
}

function css(c: readonly number[], opacity = 1): string {
	const [r, g, b, a] = c;
	return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${(a ?? 1) * opacity})`;
}

/**
 * A shape's `gpuPrimitive` drawn on a 2D canvas at `scale` px per world unit (in the
 * shape's own unrotated box, with {@link PICTURE_PAD} around it). `null` when there is no 2D canvas or nothing to draw.
 */
export function primitivePicture(
	shape: ShapeData,
	prim: GpuPrimitive,
	scale: number,
): HTMLCanvasElement | null {
	if (typeof document === "undefined") return null;
	const w = Math.max(1, Math.ceil((shape.width + 2 * PICTURE_PAD) * scale));
	const h = Math.max(1, Math.ceil((shape.height + 2 * PICTURE_PAD) * scale));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const g = canvas.getContext("2d");
	if (!g) return null;
	g.scale(scale, scale);
	g.translate(PICTURE_PAD - shape.x, PICTURE_PAD - shape.y);
	const { bounds } = prim;
	const half = prim.strokeWidth / 2;
	g.beginPath();
	if (prim.kind === "rect") {
		const r = Math.min(prim.cornerRadius ?? 0, bounds.width / 2, bounds.height / 2);
		g.roundRect(
			bounds.x + half,
			bounds.y + half,
			bounds.width - 2 * half,
			bounds.height - 2 * half,
			r,
		);
	} else if (prim.kind === "ellipse") {
		g.ellipse(
			bounds.x + bounds.width / 2,
			bounds.y + bounds.height / 2,
			Math.max(0, bounds.width / 2 - half),
			Math.max(0, bounds.height / 2 - half),
			0,
			0,
			Math.PI * 2,
		);
	} else if (prim.vertices && prim.vertices.length >= 4) {
		const v = prim.vertices;
		g.moveTo(v[0], v[1]);
		for (let i = 2; i + 1 < v.length; i += 2) g.lineTo(v[i], v[i + 1]);
		if (prim.kind === "polygon") g.closePath();
	} else {
		return null;
	}
	g.globalAlpha = Math.min(1, Math.max(0, prim.opacity));
	if (prim.kind !== "polyline" && prim.fill[3] > 0) {
		g.fillStyle = css(prim.fill);
		g.fill();
	}
	if (prim.strokeWidth > 0 && prim.stroke[3] > 0) {
		g.lineWidth = prim.strokeWidth;
		g.lineJoin = "round";
		g.lineCap = "round";
		g.strokeStyle = css(prim.stroke);
		g.stroke();
	}
	return canvas;
}
