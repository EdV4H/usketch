// The demo app's look for the character plugin (the plugin itself draws nothing).
// A top-down "pawn" (round body + nose showing the facing) or, with
// `appearance.kind === "car"`, a small top-down car. Both turn by `screenHeading`;
// the name label stays upright underneath. While hovering a glow shows at the feet, and
// a small ring beside the body shows the hover gauge (only while hovering or refilling).
// `renderCharacterShadow` is the round shadow left on the ground under a jumping character.
import type { CharacterAppearance, CharacterRenderProps } from "@edv4h/usketch-plugin-character";

/** Stable hue per user so each player keeps a recognizable color. */
export function characterColor(seed: string): string {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return `hsl(${h % 360}, 70%, 52%)`;
}

/** The appearance this client broadcasts (others render it with their own copy of this renderer). */
export function characterAppearance(
	seed: string,
	kind: "pawn" | "car" = "pawn",
): CharacterAppearance {
	return { color: characterColor(seed), kind };
}

const SIZE = 36;

function Pawn({ color }: { color: string }) {
	return (
		<svg width={SIZE} height={SIZE} viewBox="-18 -18 36 36" aria-hidden="true">
			<path d="M0 -17 L7 -9 L-7 -9 Z" fill={color} stroke="#fff" strokeWidth={1.5} />
			<circle r={11} fill={color} stroke="#fff" strokeWidth={2.5} />
			<circle cx={-4} cy={-4} r={2} fill="#fff" />
			<circle cx={4} cy={-4} r={2} fill="#fff" />
		</svg>
	);
}

function Car({ color }: { color: string }) {
	return (
		<svg width={SIZE} height={SIZE} viewBox="-18 -18 36 36" aria-hidden="true">
			<rect
				x={-9}
				y={-16}
				width={18}
				height={32}
				rx={6}
				fill={color}
				stroke="#fff"
				strokeWidth={2}
			/>
			<rect x={-6.5} y={-9} width={13} height={7} rx={2} fill="rgba(255,255,255,0.75)" />
			<rect x={-6.5} y={6} width={13} height={5} rx={2} fill="rgba(0,0,0,0.25)" />
			<rect x={-12} y={-12} width={3} height={7} rx={1} fill="#222" />
			<rect x={9} y={-12} width={3} height={7} rx={1} fill="#222" />
			<rect x={-12} y={6} width={3} height={7} rx={1} fill="#222" />
			<rect x={9} y={6} width={3} height={7} rx={1} fill="#222" />
		</svg>
	);
}

/** Hover glow at the feet: a soft cyan ring with a few "wind" strokes. */
function HoverGlow() {
	return (
		<svg
			width={SIZE * 1.4}
			height={SIZE * 0.6}
			viewBox="-25 -11 50 22"
			aria-hidden="true"
			style={{
				position: "absolute",
				left: "50%",
				top: SIZE * 0.72,
				transform: "translateX(-50%)",
				pointerEvents: "none",
			}}
		>
			<ellipse rx={20} ry={7} fill="rgba(120, 220, 255, 0.28)" />
			<ellipse rx={14} ry={4.5} fill="none" stroke="rgba(200, 245, 255, 0.9)" strokeWidth={1.5} />
			<path
				d="M-9 3 L-11 9 M0 4 L0 10 M9 3 L11 9"
				stroke="rgba(200, 245, 255, 0.8)"
				strokeWidth={1.5}
				strokeLinecap="round"
			/>
		</svg>
	);
}

const GAUGE_R = 6;
const GAUGE_LEN = 2 * Math.PI * GAUGE_R;

/** The hover gauge: a small ring beside the body, green → amber → red as it empties. */
function HoverGauge({ value }: { value: number }) {
	const v = Math.min(1, Math.max(0, value));
	const color = v > 0.5 ? "#4ade80" : v > 0.2 ? "#fbbf24" : "#f87171";
	return (
		<svg
			width={16}
			height={16}
			viewBox="-8 -8 16 16"
			aria-hidden="true"
			style={{ position: "absolute", left: SIZE - 2, top: -4, pointerEvents: "none" }}
		>
			<circle r={GAUGE_R} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
			<circle
				r={GAUGE_R}
				fill="none"
				stroke={color}
				strokeWidth={2.5}
				strokeLinecap="round"
				strokeDasharray={`${GAUGE_LEN * v} ${GAUGE_LEN}`}
				transform="rotate(-90)"
			/>
		</svg>
	);
}

export function renderCharacter(props: CharacterRenderProps) {
	const color = typeof props.appearance.color === "string" ? props.appearance.color : "#4a7cff";
	const body = props.appearance.kind === "car" ? <Car color={color} /> : <Pawn color={color} />;
	// The gauge only while it matters: hovering, or refilling after a hover.
	const gauge =
		props.hoverGauge !== null && (props.hovering || props.hoverGauge < 1) ? props.hoverGauge : null;
	return (
		<div
			style={{
				position: "relative",
				width: SIZE,
				height: SIZE,
				filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
			}}
		>
			{props.hovering && <HoverGlow />}
			<div style={{ transform: `rotate(${props.screenHeading}deg)`, width: SIZE, height: SIZE }}>
				{body}
			</div>
			{gauge !== null && <HoverGauge value={gauge} />}
			{props.name && (
				<div
					style={{
						position: "absolute",
						top: SIZE + 2,
						left: "50%",
						transform: "translateX(-50%)",
						fontSize: 11,
						fontFamily: "system-ui, sans-serif",
						color: "#fff",
						background: "rgba(0,0,0,0.55)",
						borderRadius: 4,
						padding: "1px 5px",
						whiteSpace: "nowrap",
					}}
				>
					{props.isSelf ? `${props.name}（あなた）` : props.name}
				</div>
			)}
		</div>
	);
}

/** World units of altitude at which the shadow has shrunk to half its size. */
const SHADOW_HALF_ALTITUDE = 60;

/** A soft round shadow on the ground: smaller and fainter the higher the character is. */
export function renderCharacterShadow(props: CharacterRenderProps) {
	const k = 1 / (1 + Math.max(0, props.altitude) / SHADOW_HALF_ALTITUDE);
	const d = SIZE * 0.8 * k;
	return (
		<div
			style={{
				width: d,
				height: d,
				borderRadius: "50%",
				// A soft edge from the gradient, not `filter: blur` — a filter inside Mode 7's
				// preserve-3d scene is re-rasterized on the GPU whenever the scene moves.
				background: `radial-gradient(closest-side, rgba(0, 0, 0, ${(0.35 * k).toFixed(3)}) 70%, rgba(0, 0, 0, 0))`,
			}}
		/>
	);
}
