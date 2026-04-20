import { useEffect, useState } from "react";
import type { SlideNavigator } from "./slide-navigator.js";

interface Props {
	nav: SlideNavigator;
}

export function PresentModeOverlay({ nav }: Props) {
	const [index, setIndex] = useState(nav.getCurrentIndex());
	const [total, setTotal] = useState(nav.getSlides().length);
	const [visible, setVisible] = useState(true);

	useEffect(() => {
		const unsub = nav.onChange((i) => {
			setIndex(i);
			setTotal(nav.getSlides().length);
		});
		return unsub;
	}, [nav]);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		const showAndSchedule = () => {
			setVisible(true);
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => setVisible(false), 3000);
		};
		showAndSchedule();
		window.addEventListener("mousemove", showAndSchedule);
		window.addEventListener("keydown", showAndSchedule);
		return () => {
			if (timer) clearTimeout(timer);
			window.removeEventListener("mousemove", showAndSchedule);
			window.removeEventListener("keydown", showAndSchedule);
		};
	}, []);

	if (total === 0) {
		return (
			<div
				style={{
					position: "fixed",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					pointerEvents: "none",
					color: "rgba(255,255,255,0.7)",
					background: "rgba(0,0,0,0.3)",
					font: "14px system-ui",
				}}
			>
				スライド（Frame）がありません。編集モードでフレームを追加してください。
			</div>
		);
	}

	const progress = total > 1 ? index / (total - 1) : 1;

	const exitPresent = () => {
		const url = new URL(window.location.href);
		url.searchParams.set("mode", "edit");
		window.history.replaceState(null, "", url.toString());
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				pointerEvents: "none",
				opacity: visible ? 1 : 0,
				transition: "opacity 0.3s",
			}}
		>
			<button
				type="button"
				onClick={exitPresent}
				title="編集モードに戻る (Esc)"
				aria-label="編集モードに戻る"
				style={{
					position: "absolute",
					top: 16,
					right: 16,
					appearance: "none",
					background: "rgba(0,0,0,0.6)",
					border: "none",
					color: "white",
					cursor: "pointer",
					width: 36,
					height: 36,
					borderRadius: "50%",
					fontSize: 18,
					lineHeight: 1,
					pointerEvents: "auto",
				}}
			>
				✕
			</button>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: 3,
					background: "rgba(255,255,255,0.1)",
				}}
			>
				<div
					style={{
						height: "100%",
						width: `${progress * 100}%`,
						background: "#4f9dff",
						transition: "width 0.3s",
					}}
				/>
			</div>

			<div
				style={{
					position: "absolute",
					bottom: 24,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "8px 16px",
					background: "rgba(0,0,0,0.6)",
					color: "white",
					borderRadius: 999,
					font: "14px system-ui",
					pointerEvents: "auto",
				}}
			>
				<button
					type="button"
					onClick={() => nav.prev()}
					disabled={index === 0}
					style={buttonStyle(index === 0)}
					aria-label="前のスライド"
				>
					‹
				</button>
				<span style={{ minWidth: 48, textAlign: "center" }}>
					{index + 1} / {total}
				</span>
				<button
					type="button"
					onClick={() => nav.next()}
					disabled={index >= total - 1}
					style={buttonStyle(index >= total - 1)}
					aria-label="次のスライド"
				>
					›
				</button>
			</div>
		</div>
	);
}

function buttonStyle(disabled: boolean): React.CSSProperties {
	return {
		appearance: "none",
		border: "none",
		background: "transparent",
		color: "white",
		cursor: disabled ? "default" : "pointer",
		opacity: disabled ? 0.3 : 1,
		fontSize: 20,
		width: 28,
		height: 28,
		borderRadius: 4,
	};
}
