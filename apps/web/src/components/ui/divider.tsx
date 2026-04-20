interface DividerProps {
	vertical?: boolean;
}

export function Divider({ vertical }: DividerProps) {
	return (
		<div
			style={{
				width: vertical ? 1 : 16,
				height: vertical ? 16 : 1,
				background: "var(--border-default)",
				margin: vertical ? "0 4px" : "4px 0",
				flexShrink: 0,
			}}
		/>
	);
}
