// The hand-drawn wobble: a displacement of the drawn terrain by smooth noise. The noise
// is generated once into a small tileable bitmap (feImage + feTile) instead of an
// feTurbulence: a filter that moves pixels is applied by the compositor on every frame
// the layer moves, and recomputing fractal noise over the whole screen each time was
// the main cost of walking around the map.

/** World units one noise tile spans (the bitmap repeats every this many units). */
const NOISE_PERIOD = 512;
/** Bitmap size in px (the noise is smooth, so a coarse bitmap scaled up is enough). */
const NOISE_PX = 128;
/** Lattice cells across one period for the first octave (≈ the old 0.014 base frequency). */
const NOISE_CELLS = 7;
const DISPLACEMENT = 2.1;

let noiseUrl: string | null | undefined;

/** Deterministic hash → [0, 1). */
function hash(x: number, y: number, ch: number): number {
	let h = (x * 374761393 + y * 668265263 + ch * 2147483647 + 7 * 1442695041) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Periodic value noise in [0, 1] at (u, v) ∈ [0, 1)², `cells` lattice cells per period. */
function valueNoise(u: number, v: number, cells: number, ch: number): number {
	const x = u * cells;
	const y = v * cells;
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;
	const sx = fx * fx * (3 - 2 * fx);
	const sy = fy * fy * (3 - 2 * fy);
	const at = (i: number, j: number) =>
		hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, ch);
	const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
	const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
	return a + (b - a) * sy;
}

/**
 * The noise bitmap as a data URL (R and G channels: x and y displacement), built once.
 * `null` where there is no canvas (tests, SSR): the filter then falls back to feTurbulence.
 */
export function wobbleNoiseUrl(): string | null {
	if (noiseUrl !== undefined) return noiseUrl;
	noiseUrl = null;
	if (typeof document === "undefined") return noiseUrl;
	const canvas = document.createElement("canvas");
	canvas.width = NOISE_PX;
	canvas.height = NOISE_PX;
	const g = canvas.getContext("2d");
	if (!g) return noiseUrl;
	const img = g.createImageData(NOISE_PX, NOISE_PX);
	for (let py = 0; py < NOISE_PX; py++) {
		for (let px = 0; px < NOISE_PX; px++) {
			const u = px / NOISE_PX;
			const v = py / NOISE_PX;
			const i = (py * NOISE_PX + px) * 4;
			for (let ch = 0; ch < 2; ch++) {
				// Two octaves, centred on 0.5 so the displacement averages out to none.
				const n =
					(valueNoise(u, v, NOISE_CELLS, ch) * 2 + valueNoise(u, v, NOISE_CELLS * 2, ch + 2)) / 3;
				img.data[i + ch] = Math.round(n * 255);
			}
			img.data[i + 2] = 0;
			img.data[i + 3] = 255;
		}
	}
	g.putImageData(img, 0, 0);
	noiseUrl = canvas.toDataURL();
	return noiseUrl;
}

/**
 * The wobble `<filter>` (place inside `<defs>`); its noise is anchored to world space.
 * `region` (world units) bounds the filtered area; default: the content's box + 10%.
 */
export function WobbleFilter({ id, region }: { id: string; region?: DOMRectReadOnly | null }) {
	const url = wobbleNoiseUrl();
	const bounds = region && {
		filterUnits: "userSpaceOnUse",
		x: region.left,
		y: region.top,
		width: region.width,
		height: region.height,
	};
	return (
		<filter id={id} {...bounds}>
			{url ? (
				<>
					<feImage
						href={url}
						x={0}
						y={0}
						width={NOISE_PERIOD}
						height={NOISE_PERIOD}
						preserveAspectRatio="none"
						result="tile"
					/>
					<feTile in="tile" result="n" />
				</>
			) : (
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.014"
					numOctaves="2"
					seed="7"
					result="n"
				/>
			)}
			<feDisplacementMap
				in="SourceGraphic"
				in2="n"
				scale={DISPLACEMENT}
				xChannelSelector="R"
				yChannelSelector="G"
			/>
		</filter>
	);
}
