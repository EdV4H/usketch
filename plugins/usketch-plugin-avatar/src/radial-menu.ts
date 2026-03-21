export interface RadialMenuItem {
	id: string;
	label: string;
	icon: string;
}

const RADIUS = 80;
const ITEM_SIZE = 40;

export function createRadialMenu(onSelect: (id: string) => void) {
	let visible = false;

	const overlay = document.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		zIndex: "300",
		display: "none",
	});
	overlay.addEventListener("pointerdown", (e) => {
		if (e.target === overlay) hide();
	});

	const ring = document.createElement("div");
	Object.assign(ring.style, {
		position: "absolute",
		pointerEvents: "none",
	});
	overlay.appendChild(ring);
	document.body.appendChild(overlay);

	function show(cx: number, cy: number, items: RadialMenuItem[]) {
		// 既存アイテムをクリア
		ring.innerHTML = "";
		ring.style.left = `${cx}px`;
		ring.style.top = `${cy}px`;

		const angleStep = (2 * Math.PI) / items.length;
		const startAngle = -Math.PI / 2; // 12時方向から開始

		for (let i = 0; i < items.length; i++) {
			const angle = startAngle + angleStep * i;
			const x = Math.cos(angle) * RADIUS - ITEM_SIZE / 2;
			const y = Math.sin(angle) * RADIUS - ITEM_SIZE / 2;

			const btn = document.createElement("button");
			btn.title = items[i].label;
			btn.textContent = items[i].icon;
			Object.assign(btn.style, {
				position: "absolute",
				left: `${x}px`,
				top: `${y}px`,
				width: `${ITEM_SIZE}px`,
				height: `${ITEM_SIZE}px`,
				borderRadius: "50%",
				border: "none",
				background: "#fff",
				boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
				fontSize: "16px",
				cursor: "pointer",
				pointerEvents: "auto",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				transition: "transform 0.15s, box-shadow 0.15s",
			});

			const itemId = items[i].id;
			btn.addEventListener("pointerdown", (e) => {
				e.stopPropagation();
				onSelect(itemId);
				hide();
			});
			btn.addEventListener("mouseenter", () => {
				btn.style.transform = "scale(1.15)";
				btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
			});
			btn.addEventListener("mouseleave", () => {
				btn.style.transform = "none";
				btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
			});

			ring.appendChild(btn);
		}

		visible = true;
		overlay.style.display = "block";
	}

	function hide() {
		visible = false;
		overlay.style.display = "none";
	}

	function toggle(cx: number, cy: number, items: RadialMenuItem[]) {
		if (visible) {
			hide();
		} else {
			show(cx, cy, items);
		}
	}

	function destroy() {
		overlay.remove();
	}

	return { show, hide, toggle, destroy, isVisible: () => visible };
}
