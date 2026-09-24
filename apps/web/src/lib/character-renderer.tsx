// The demo app's look for the character plugin (the plugin itself draws nothing).
// A top-down "pawn" (round body + nose showing the facing) or, with
// `appearance.kind === "car"`, a small top-down car. Both turn by `screenHeading`;
// the name label stays upright underneath.
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

export function renderCharacter(props: CharacterRenderProps) {
	const color = typeof props.appearance.color === "string" ? props.appearance.color : "#4a7cff";
	const body = props.appearance.kind === "car" ? <Car color={color} /> : <Pawn color={color} />;
	return (
		<div
			style={{
				position: "relative",
				width: SIZE,
				height: SIZE,
				filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
			}}
		>
			<div style={{ transform: `rotate(${props.screenHeading}deg)`, width: SIZE, height: SIZE }}>
				{body}
			</div>
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
