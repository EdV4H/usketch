// The demo app's look for the character plugin (the plugin itself draws nothing).
// A top-down "pawn" (round body + nose showing the facing) or, in the car scheme
// (`controlScheme === "vehicle"`, or `appearance.kind === "car"`), a solid box: a top
// face lifted by CSS 3D over four walls folded up from its edges, so under Mode 7 it
// stands as a block while the flat board sees just its top. Both turn by
// `screenHeading` (the car also by its drift `slip`, and in the air it tips by its
// `pitch` / `roll`); the name label stays upright underneath. While hovering a glow shows at the feet, and
// a small ring beside the body shows the hover gauge (only while hovering or refilling).
// `renderCharacterShadow` is the round shadow left on the ground under a jumping character.
import type { CharacterAppearance, CharacterRenderProps } from "@edv4h/usketch-plugin-character";
import { OCCLUDED_OPACITY } from "@edv4h/usketch-shared";

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

function Pawn({ color, size }: { color: string; size: number }) {
	return (
		<svg width={size} height={size} viewBox="-18 -18 36 36" aria-hidden="true">
			<path d="M0 -17 L7 -9 L-7 -9 Z" fill={color} stroke="#fff" strokeWidth={1.5} />
			<circle r={11} fill={color} stroke="#fff" strokeWidth={2.5} />
			<circle cx={-4} cy={-4} r={2} fill="#fff" />
			<circle cx={4} cy={-4} r={2} fill="#fff" />
		</svg>
	);
}

/** The car box's footprint and height, as fractions of the sprite `size`. */
const CAR_WIDTH = 0.5;
const CAR_LENGTH = 0.86;
const CAR_HEIGHT = 0.32;

/** Whether to draw the car box: the vehicle scheme, or a look that asks for a car. */
export function isCar(props: Pick<CharacterRenderProps, "controlScheme" | "appearance">): boolean {
	return props.controlScheme === "vehicle" || props.appearance.kind === "car";
}

type CarSide = "front" | "back" | "left" | "right";

/**
 * The four walls of a `w` × `l` box (`h` tall) in its own px frame, front = up: each a
 * strip along one edge folded up about it (as shape-3d's `boxWalls`), its face outward.
 */
function carWalls(w: number, l: number, h: number) {
	return [
		{
			side: "front",
			left: 0,
			top: 0,
			width: w,
			height: h,
			origin: "50% 0%",
			turn: "rotateX(90deg)",
		},
		{
			side: "right",
			left: w - h,
			top: 0,
			width: h,
			height: l,
			origin: "100% 50%",
			turn: "rotateY(90deg)",
		},
		{
			side: "back",
			left: 0,
			top: l - h,
			width: w,
			height: h,
			origin: "50% 100%",
			turn: "rotateX(-90deg)",
		},
		{
			side: "left",
			left: 0,
			top: 0,
			width: h,
			height: l,
			origin: "0% 50%",
			turn: "rotateY(-90deg)",
		},
	] as const satisfies readonly {
		side: CarSide;
		left: number;
		top: number;
		width: number;
		height: number;
		origin: string;
		turn: string;
	}[];
}

/** Darkening of each wall: the sides a touch darker than the ends, as the map's cliffs. */
const WALL_SHADE: Record<CarSide, number> = { front: 0.18, back: 0.28, left: 0.38, right: 0.38 };

/** What's painted on a wall: lights on the ends, two wheels on each side. */
function WallDetail({ side, h }: { side: CarSide; h: number }) {
	const lamp = (color: string, left: string) => (
		<div
			style={{
				position: "absolute",
				left,
				top: "22%",
				width: "22%",
				height: "34%",
				borderRadius: h * 0.12,
				background: color,
			}}
		/>
	);
	if (side === "front") {
		return (
			<>
				{lamp("#fff7c2", "10%")}
				{lamp("#fff7c2", "68%")}
			</>
		);
	}
	if (side === "back") {
		return (
			<>
				{lamp("#ff4d4d", "10%")}
				{lamp("#ff4d4d", "68%")}
			</>
		);
	}
	// A side wall runs front (top) → back (bottom); its height is the box's, across it.
	const wheel = (top: string) => (
		<div
			style={{
				position: "absolute",
				top,
				left: "8%",
				width: "84%",
				height: "24%",
				borderRadius: h * 0.2,
				background: "#1f1f1f",
			}}
		/>
	);
	return (
		<>
			{wheel("10%")}
			{wheel("66%")}
		</>
	);
}

/**
 * CSS that tips the car box by its attitude in the air (`pitch` nose up, `roll` right side
 * down, degrees) about its middle, `h` px up: `undefined` when level.
 */
export function carTiltTransform(pitch: number, roll: number, h: number): string | undefined {
	if (pitch === 0 && roll === 0) return undefined;
	const mid = Math.round(h * 50) / 100;
	return `translateZ(${mid}px) rotateX(${-pitch}deg) rotateY(${roll}deg) translateZ(${-mid}px)`;
}

function CarBox({
	color,
	size,
	pitch,
	roll,
	opacity,
}: {
	color: string;
	size: number;
	pitch: number;
	roll: number;
	/** Set on each face (opacity on the box would flatten it). */
	opacity?: number;
}) {
	const w = size * CAR_WIDTH;
	const l = size * CAR_LENGTH;
	const h = size * CAR_HEIGHT;
	const edge = Math.max(1, size * 0.05);
	return (
		<div
			data-character-car=""
			style={{
				position: "absolute",
				left: (size - w) / 2,
				top: (size - l) / 2,
				width: w,
				height: l,
				transformStyle: "preserve-3d",
				// Tipped in the air (pitch / roll), after the turn to the heading outside.
				transform: carTiltTransform(pitch, roll, h),
			}}
		>
			{carWalls(w, l, h).map((wall) => (
				<div
					key={wall.side}
					data-car-wall={wall.side}
					style={{
						position: "absolute",
						left: wall.left,
						top: wall.top,
						width: wall.width,
						height: wall.height,
						transformOrigin: wall.origin,
						transform: wall.turn,
						background: color,
						boxShadow: `inset 0 0 0 9999px rgba(0,0,0,${WALL_SHADE[wall.side]})`,
						backfaceVisibility: "hidden",
						opacity,
					}}
				>
					<WallDetail side={wall.side} h={h} />
				</div>
			))}
			<div
				data-car-top=""
				style={{
					position: "absolute",
					inset: 0,
					boxSizing: "border-box",
					border: `${edge}px solid #fff`,
					borderRadius: size * 0.06,
					background: color,
					transform: `translateZ(${h}px)`,
					opacity,
				}}
			>
				{/* Windshield (front) and rear window. */}
				<div
					style={{
						position: "absolute",
						left: "14%",
						right: "14%",
						top: "20%",
						height: "22%",
						borderRadius: size * 0.04,
						background: "rgba(255,255,255,0.75)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: "14%",
						right: "14%",
						bottom: "12%",
						height: "14%",
						borderRadius: size * 0.04,
						background: "rgba(0,0,0,0.25)",
					}}
				/>
			</div>
		</div>
	);
}

/** Hover glow at the feet: a soft cyan ring with a few "wind" strokes. */
function HoverGlow({ size }: { size: number }) {
	return (
		<svg
			width={size * 1.4}
			height={size * 0.6}
			viewBox="-25 -11 50 22"
			aria-hidden="true"
			style={{
				position: "absolute",
				left: "50%",
				top: size * 0.72,
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
function HoverGauge({ value, size }: { value: number; size: number }) {
	const v = Math.min(1, Math.max(0, value));
	const color = v > 0.5 ? "#4ade80" : v > 0.2 ? "#fbbf24" : "#f87171";
	return (
		<svg
			width={16}
			height={16}
			viewBox="-8 -8 16 16"
			aria-hidden="true"
			style={{ position: "absolute", left: size - 2, top: -4, pointerEvents: "none" }}
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
	// The plugin's size setting (fixed on screen, or scaled with the ground) at this zoom.
	const size = props.size;
	const car = isCar(props);
	// The gauge only while it matters: hovering, or refilling after a hover.
	const faded = props.occluded === "fade";
	const gauge =
		props.hoverGauge !== null && (props.hovering || props.hoverGauge < 1) ? props.hoverGauge : null;
	return (
		<div
			style={{
				position: "relative",
				width: size,
				height: size,
				// A filter would flatten the car's 3D box: it keeps the CSS 3D context instead
				// (its shadow is the ground shadow's).
				filter: car ? undefined : "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
				transformStyle: car ? "preserve-3d" : undefined,
				// Behind a hill: the flat pawn fades whole, the car box face by face.
				opacity: !car && faded ? OCCLUDED_OPACITY : undefined,
			}}
		>
			{props.hovering && <HoverGlow size={size} />}
			{car ? (
				<div
					style={{
						position: "absolute",
						inset: 0,
						transform: `rotate(${props.screenHeading + props.slip}deg)`,
						transformStyle: "preserve-3d",
					}}
				>
					<CarBox
						color={color}
						size={size}
						pitch={props.pitch}
						roll={props.roll}
						opacity={faded ? OCCLUDED_OPACITY : undefined}
					/>
				</div>
			) : (
				<div style={{ transform: `rotate(${props.screenHeading}deg)`, width: size, height: size }}>
					<Pawn color={color} size={size} />
				</div>
			)}
			{gauge !== null && <HoverGauge value={gauge} size={size} />}
			{props.name && (
				<div
					style={{
						position: "absolute",
						top: size + 2,
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

/**
 * A soft shadow on the ground, smaller and fainter the higher the character is: round
 * under the pawn, a rounded rectangle turned with the car under the car box.
 */
export function renderCharacterShadow(props: CharacterRenderProps) {
	const k = 1 / (1 + Math.max(0, props.altitude) / SHADOW_HALF_ALTITUDE);
	const alpha = (0.35 * k).toFixed(3);
	if (isCar(props)) {
		const w = props.size * CAR_WIDTH * 1.1 * k;
		const l = props.size * CAR_LENGTH * 1.05 * k;
		return (
			<div
				style={{
					width: w,
					height: l,
					borderRadius: Math.min(w, l) * 0.3,
					background: `rgba(0, 0, 0, ${alpha})`,
					// A soft edge from box-shadow, not `filter: blur` (see below).
					boxShadow: `0 0 ${Math.max(1, props.size * 0.08)}px rgba(0, 0, 0, ${alpha})`,
					transform: `rotate(${props.screenHeading + props.slip}deg)`,
				}}
			/>
		);
	}
	const d = props.size * 0.8 * k;
	return (
		<div
			style={{
				width: d,
				height: d,
				borderRadius: "50%",
				// A soft edge from the gradient, not `filter: blur` — a filter inside Mode 7's
				// preserve-3d scene is re-rasterized on the GPU whenever the scene moves.
				background: `radial-gradient(closest-side, rgba(0, 0, 0, ${alpha}) 70%, rgba(0, 0, 0, 0))`,
			}}
		/>
	);
}
