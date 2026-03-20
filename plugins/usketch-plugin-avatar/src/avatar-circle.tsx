const AVATAR_SIZE = 40;

const COLORS = [
	"#e74c3c",
	"#3498db",
	"#2ecc71",
	"#f39c12",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
	"#e84393",
];

function getUserColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash * 31 + userId.charCodeAt(i)) | 0;
	}
	return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
	return name
		.split(/\s+/)
		.map((w) => w[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function AvatarCircle({
	image,
	name,
	userId,
	size = AVATAR_SIZE,
	opacity = 1,
}: {
	image?: string | null;
	name: string;
	userId: string;
	size?: number;
	opacity?: number;
}) {
	const color = getUserColor(userId);
	const initials = getInitials(name || "?");

	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				overflow: "hidden",
				border: `2px solid ${color}`,
				background: color,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: size * 0.4,
				fontWeight: 600,
				color: "#fff",
				fontFamily: "system-ui, sans-serif",
				pointerEvents: "none",
				opacity,
				userSelect: "none",
			}}
		>
			{image ? (
				<img src={image} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
			) : (
				initials
			)}
		</div>
	);
}
