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

	// 発表モードに入った直後は Canvas コンテナサイズが edit → 画面全体に切り替わる
	// 途中でもあり得る。React のレイアウト確定 (double rAF) を待って先頭スライドに fit する。
	useEffect(() => {
		let raf1: number;
		let raf2 = 0;
		raf1 = requestAnimationFrame(() => {
			raf2 = requestAnimationFrame(() => {
				nav.first();
			});
		});
		return () => {
			cancelAnimationFrame(raf1);
			if (raf2) cancelAnimationFrame(raf2);
		};
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
					color: "var(--fg-secondary)",
					background: "rgba(0,0,0,0.3)",
					backdropFilter: "blur(4px)",
					WebkitBackdropFilter: "blur(4px)",
					fontFamily: "var(--font-sans, system-ui)",
					fontSize: 14,
				}}
			>
				<div
					className="u-surface"
					style={{
						padding: "16px 24px",
						borderRadius: 12,
						background: "var(--bg-surface-raised)",
					}}
				>
					スライド（Frame）がありません。編集モードでフレームを追加してください。
				</div>
			</div>
		);
	}

	const progress = total > 1 ? index / (total - 1) : 1;

	const exitPresent = () => {
		const url = new URL(window.location.href);
		url.searchParams.set("present", "1");
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
				fontFamily: "var(--font-sans, system-ui)",
			}}
		>
			{/* 閉じるボタン (右上) */}
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
					background: "rgba(255,255,255,0.1)",
					backdropFilter: "blur(16px)",
					WebkitBackdropFilter: "blur(16px)",
					border: "1px solid rgba(255,255,255,0.1)",
					color: "white",
					cursor: "pointer",
					width: 36,
					height: 36,
					borderRadius: 10,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					pointerEvents: "auto",
					padding: 0,
				}}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
				</svg>
			</button>

			{/* 上部プログレスバー */}
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
						background: "var(--brand-gradient)",
						transition: "width 0.3s",
					}}
				/>
			</div>

			{/* 下部ナビ pill */}
			<div
				style={{
					position: "absolute",
					bottom: 24,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					alignItems: "center",
					gap: 2,
					padding: 4,
					borderRadius: 999,
					background: "rgba(20,20,25,0.85)",
					backdropFilter: "blur(20px)",
					WebkitBackdropFilter: "blur(20px)",
					border: "1px solid rgba(255,255,255,0.1)",
					pointerEvents: "auto",
					boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
				}}
			>
				<NavButton
					disabled={index === 0}
					onClick={() => nav.prev()}
					ariaLabel="前のスライド"
					direction="prev"
				/>
				<div
					style={{
						padding: "0 12px",
						fontSize: 13,
						fontFamily: "var(--font-mono)",
						letterSpacing: 0,
						minWidth: 60,
						textAlign: "center",
					}}
				>
					<span style={{ color: "white", fontWeight: 600 }}>{index + 1}</span>
					<span style={{ color: "rgba(255,255,255,0.5)" }}> / {total}</span>
				</div>
				<NavButton
					disabled={index >= total - 1}
					onClick={() => nav.next()}
					ariaLabel="次のスライド"
					direction="next"
				/>
				<div
					style={{
						width: 1,
						height: 20,
						background: "rgba(255,255,255,0.15)",
						margin: "0 4px",
					}}
				/>
				<button
					type="button"
					onClick={exitPresent}
					title="発表を終了 (Esc)"
					aria-label="発表を終了"
					style={{
						appearance: "none",
						border: "none",
						background: "transparent",
						color: "white",
						cursor: "pointer",
						height: 34,
						padding: "0 12px",
						borderRadius: 999,
						display: "flex",
						alignItems: "center",
						gap: 6,
						fontSize: 12,
						fontFamily: "inherit",
					}}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
					</svg>
					終了
				</button>
			</div>
		</div>
	);
}

function NavButton({
	disabled,
	onClick,
	ariaLabel,
	direction,
}: {
	disabled: boolean;
	onClick: () => void;
	ariaLabel: string;
	direction: "prev" | "next";
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			style={{
				appearance: "none",
				border: "none",
				background: "transparent",
				color: "white",
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.3 : 1,
				width: 34,
				height: 34,
				borderRadius: 999,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 0,
				transition: "background var(--dur-fast)",
			}}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				{direction === "prev" ? <path d="m10 4-4 4 4 4" /> : <path d="m6 4 4 4-4 4" />}
			</svg>
		</button>
	);
}
