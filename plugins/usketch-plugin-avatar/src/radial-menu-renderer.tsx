import type { TransientObject } from "@edv4h/usketch-shared";
import type { RadialMenuItem } from "./radial-menu.js";

const RADIUS = 80;
const ITEM_SIZE = 36;

export function RadialMenuRenderer({
	obj,
	onSelect,
}: {
	obj: TransientObject;
	onSelect: (toolId: string) => void;
}) {
	const items = (obj.data.items as RadialMenuItem[]) || [];
	const angleStep = (2 * Math.PI) / items.length;
	const startAngle = -Math.PI / 2;

	return (
		<div
			style={{
				position: "absolute",
				left: -RADIUS - ITEM_SIZE / 2,
				top: -RADIUS - ITEM_SIZE / 2,
				width: (RADIUS + ITEM_SIZE) * 2,
				height: (RADIUS + ITEM_SIZE) * 2,
			}}
		>
			{items.map((item, i) => {
				const angle = startAngle + angleStep * i;
				const x = RADIUS + ITEM_SIZE / 2 + Math.cos(angle) * RADIUS - ITEM_SIZE / 2;
				const y = RADIUS + ITEM_SIZE / 2 + Math.sin(angle) * RADIUS - ITEM_SIZE / 2;

				return (
					<button
						key={item.id}
						type="button"
						title={item.label}
						onPointerDown={(e) => {
							e.stopPropagation();
							onSelect(item.id);
						}}
						style={{
							position: "absolute",
							left: x,
							top: y,
							width: ITEM_SIZE,
							height: ITEM_SIZE,
							borderRadius: "50%",
							border: "none",
							background: "#fff",
							boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#333",
							padding: 0,
						}}
					>
						{item.icon()}
					</button>
				);
			})}
		</div>
	);
}
