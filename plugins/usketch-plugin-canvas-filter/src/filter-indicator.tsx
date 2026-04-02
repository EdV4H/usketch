export function FilterIndicator({
	ruleCount,
	onClick,
}: {
	ruleCount: number;
	onClick: () => void;
}) {
	if (ruleCount === 0) return null;

	return (
		<div
			style={{
				position: "fixed",
				top: 56,
				right: 12,
				zIndex: 100,
				display: "flex",
				alignItems: "center",
				gap: 6,
				padding: "6px 12px",
				background: "#eef2ff",
				border: "1px solid #c7d2fe",
				borderRadius: 8,
				fontSize: 13,
				fontFamily: "system-ui, sans-serif",
				color: "#4338ca",
				cursor: "pointer",
				userSelect: "none",
			}}
			onPointerDown={onClick}
		>
			<svg
				width={14}
				height={14}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
			>
				<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
			</svg>
			<span>
				Filter active ({ruleCount} rule{ruleCount > 1 ? "s" : ""})
			</span>
			<span style={{ fontSize: 11, opacity: 0.6 }}>F</span>
		</div>
	);
}
