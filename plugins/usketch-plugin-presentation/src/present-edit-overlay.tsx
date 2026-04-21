import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { zIndexBetween } from "@edv4h/usketch-shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SlideNavigator } from "./slide-navigator.js";

interface Props {
	nav: SlideNavigator;
	store: BoardStore;
	commands: CommandRegistry;
	navigateToBoard: () => void;
}

const SIDEBAR_WIDTH = 220;
const SIDEBAR_LEFT_MARGIN = 12;
const STAGE_MAX_WIDTH = 1100;
const STAGE_PADDING = 30;
const TOP_BAR_HEIGHT = 64;
/** Toolbar (bottom: 12, 高さ約 44) + ページャー pill (高さ約 42 + 12 gap) 分の予約 */
const BOTTOM_RESERVED = 120;
const SIDEBAR_RESERVED = SIDEBAR_WIDTH + SIDEBAR_LEFT_MARGIN * 2;
const ASPECT = 9 / 16;
const SLIDE_USER_COLORS = [
	"var(--u-1)",
	"var(--u-2)",
	"var(--u-3)",
	"var(--u-4)",
	"var(--u-5)",
	"var(--u-6)",
];

interface StageRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

function computeStageRect(win: { width: number; height: number }): StageRect {
	const available = {
		width: Math.max(100, win.width - SIDEBAR_RESERVED - STAGE_PADDING * 2),
		height: Math.max(100, win.height - TOP_BAR_HEIGHT - STAGE_PADDING - BOTTOM_RESERVED),
	};
	let width = Math.min(available.width, STAGE_MAX_WIDTH);
	let height = width * ASPECT;
	if (height > available.height) {
		height = available.height;
		width = height / ASPECT;
	}
	const left = SIDEBAR_RESERVED + STAGE_PADDING + (available.width - width) / 2;
	const top = TOP_BAR_HEIGHT + STAGE_PADDING + (available.height - height) / 2;
	return { left, top, width, height };
}

/**
 * プレゼン編集モードの全画面オーバーレイ。
 * Canvas 自体はそのまま背面で動作しており、この overlay は
 *  - 左サイドバー (スライド一覧)
 *  - 上部 pill (モード切替)
 *  - 下部ナビ
 *  - ステージ穴を囲む 4 方向の黒ベール
 * を重ねるだけ。ステージ中央は pointer-events を通すので、
 * 通常のボード編集操作 (シェイプ選択・追加・移動) がそのまま使える。
 */
export function PresentEditOverlay({ nav, store, commands, navigateToBoard }: Props) {
	const [slides, setSlides] = useState<ShapeData[]>(nav.getSlides());
	const [current, setCurrent] = useState(nav.getCurrentIndex());
	const [stage, setStage] = useState<StageRect>(() =>
		computeStageRect({ width: window.innerWidth, height: window.innerHeight }),
	);
	const lastFitRef = useRef<string>("");

	useEffect(() => {
		const unsub = nav.onChange((i) => {
			setSlides(nav.getSlides());
			setCurrent(i);
		});
		return unsub;
	}, [nav]);

	// リサイズに追随
	useLayoutEffect(() => {
		const onResize = () => {
			setStage(computeStageRect({ width: window.innerWidth, height: window.innerHeight }));
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// ステージサイズに合わせて、現在のスライドを再フィット。
	// nav は getViewportSize 経由で画面全体サイズを返す前提だが、ここではステージ外に
	// canvas がはみ出しても overlay で隠れるので、敢えて fitToBounds を直接呼ぶ。
	useEffect(() => {
		const slide = slides[current];
		if (!slide) return;
		const key = `${slide.id}:${Math.round(stage.width)}x${Math.round(stage.height)}:${Math.round(stage.left)}x${Math.round(stage.top)}`;
		if (lastFitRef.current === key) return;
		lastFitRef.current = key;
		// stage の world-to-screen 比率に合わせて viewport を手動で組む。
		// fitToBounds はビューポート中心基準なので、ステージ中心 = 画面中心に
		// なるよう left/top をオフセット補正する。
		const winW = window.innerWidth;
		const winH = window.innerHeight;
		const stageCenterX = stage.left + stage.width / 2;
		const stageCenterY = stage.top + stage.height / 2;
		const screenCenterX = winW / 2;
		const screenCenterY = winH / 2;
		const zoom = Math.min(stage.width / slide.width, stage.height / slide.height);
		const viewportX =
			screenCenterX - (slide.x + slide.width / 2) * zoom + (stageCenterX - screenCenterX);
		const viewportY =
			screenCenterY - (slide.y + slide.height / 2) * zoom + (stageCenterY - screenCenterY);
		store.setViewport({ x: viewportX, y: viewportY, zoom });
	}, [slides, current, stage, store]);

	const startPresent = () => {
		const url = new URL(window.location.href);
		url.searchParams.set("present", "1");
		url.searchParams.set("mode", "present");
		window.history.replaceState(null, "", url.toString());
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	const exitToBoard = () => navigateToBoard();

	const total = slides.length;

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 500,
				pointerEvents: "none",
				fontFamily: "var(--font-sans, system-ui)",
			}}
		>
			{/* ステージ枠: Canvas がそのまま透けて見える。violet 枠で場所だけ示す。 */}
			<div
				style={{
					position: "absolute",
					left: stage.left - 1,
					top: stage.top - 1,
					width: stage.width + 2,
					height: stage.height + 2,
					borderRadius: 8,
					border: "1.5px solid var(--brand-violet)",
					boxShadow: "0 0 0 4px color-mix(in oklab, var(--brand-violet) 15%, transparent)",
					pointerEvents: "none",
				}}
			/>

			{/* サイドバー */}
			<aside
				className="u-surface"
				style={{
					position: "absolute",
					left: 12,
					top: 70,
					bottom: 80,
					width: SIDEBAR_WIDTH,
					borderRadius: 12,
					display: "flex",
					flexDirection: "column",
					pointerEvents: "auto",
					color: "var(--fg-primary)",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						padding: "14px 16px",
						borderBottom: "1px solid var(--border-subtle)",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div style={{ fontSize: 12, fontWeight: 600 }}>スライド</div>
					<div
						style={{
							fontSize: 11,
							color: "var(--fg-tertiary)",
							fontFamily: "var(--font-mono, monospace)",
						}}
					>
						{total}
					</div>
				</div>
				<div
					style={{
						flex: 1,
						overflow: "auto",
						padding: 10,
						display: "flex",
						flexDirection: "column",
						gap: 8,
					}}
				>
					{slides.map((s, i) => (
						<SlideThumb
							key={s.id}
							slide={s}
							index={i}
							active={i === current}
							onClick={() => nav.gotoIndex(i)}
							onMoveUp={i > 0 ? () => moveSlide(store, commands, s.id, -1) : undefined}
							onMoveDown={
								i < slides.length - 1 ? () => moveSlide(store, commands, s.id, +1) : undefined
							}
						/>
					))}
					<button
						type="button"
						onClick={() => addSlide(store, commands)}
						style={{
							padding: 8,
							background: "var(--bg-input)",
							border: "1px dashed var(--border-default)",
							borderRadius: 8,
							color: "var(--fg-tertiary)",
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 5,
							fontSize: 12,
							fontFamily: "inherit",
						}}
					>
						+ スライド追加
					</button>
				</div>
			</aside>

			{/* 上部 pill: モード切替 */}
			<div
				style={{
					position: "absolute",
					top: 12,
					left: SIDEBAR_RESERVED,
					right: 0,
					display: "flex",
					justifyContent: "center",
					pointerEvents: "none",
				}}
			>
				<div
					className="u-surface"
					style={{
						display: "flex",
						padding: 4,
						gap: 2,
						borderRadius: 10,
						pointerEvents: "auto",
					}}
				>
					<button type="button" onClick={exitToBoard} style={pillBtn(false)}>
						← ボード
					</button>
					<div style={{ width: 1, background: "var(--border-default)", margin: "4px 2px" }} />
					<button type="button" style={pillBtn(true)}>
						編集
					</button>
					<button
						type="button"
						onClick={startPresent}
						disabled={total === 0}
						style={{
							...pillBtn(false),
							background: total === 0 ? "var(--bg-input)" : "var(--brand-gradient)",
							color: total === 0 ? "var(--fg-tertiary)" : "white",
							opacity: total === 0 ? 0.6 : 1,
						}}
					>
						▶ 発表開始
					</button>
				</div>
			</div>

			{/* ステージ直下のページネーション pill (Toolbar と重ならないよう stage 下に追従) */}
			<div
				style={{
					position: "absolute",
					left: stage.left + stage.width / 2,
					top: stage.top + stage.height + 12,
					transform: "translateX(-50%)",
					display: "flex",
					justifyContent: "center",
					pointerEvents: "none",
				}}
			>
				<div
					className="u-surface"
					style={{
						display: "flex",
						alignItems: "center",
						gap: 2,
						padding: 4,
						borderRadius: 999,
						pointerEvents: "auto",
					}}
				>
					<button
						type="button"
						onClick={() => nav.prev()}
						disabled={current === 0}
						style={navBtn(current === 0)}
						aria-label="前のスライド"
					>
						‹
					</button>
					<div
						style={{
							padding: "0 12px",
							fontSize: 13,
							color: "var(--fg-primary)",
							fontFamily: "var(--font-mono, monospace)",
							minWidth: 60,
							textAlign: "center",
						}}
					>
						<span style={{ fontWeight: 600 }}>{total === 0 ? 0 : current + 1}</span>
						<span style={{ color: "var(--fg-tertiary)" }}> / {total}</span>
					</div>
					<button
						type="button"
						onClick={() => nav.next()}
						disabled={current >= total - 1}
						style={navBtn(current >= total - 1)}
						aria-label="次のスライド"
					>
						›
					</button>
				</div>
			</div>

			{total === 0 && (
				<div
					style={{
						position: "absolute",
						left: stage.left,
						top: stage.top,
						width: stage.width,
						height: stage.height,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "var(--fg-tertiary)",
						fontSize: 13,
						background: "var(--bg-canvas)",
						borderRadius: 8,
						pointerEvents: "none",
					}}
				>
					Frame を追加するとスライドになります
				</div>
			)}
		</div>
	);
}

function pillBtn(active: boolean): React.CSSProperties {
	return {
		appearance: "none",
		border: "none",
		background: active ? "var(--bg-active)" : "transparent",
		color: active ? "var(--brand-violet)" : "var(--fg-secondary)",
		cursor: "pointer",
		padding: "6px 12px",
		borderRadius: 6,
		fontSize: 12,
		fontWeight: 500,
		fontFamily: "inherit",
		display: "inline-flex",
		alignItems: "center",
		gap: 5,
	};
}

function navBtn(disabled: boolean): React.CSSProperties {
	return {
		appearance: "none",
		width: 34,
		height: 34,
		borderRadius: 999,
		background: "transparent",
		border: "none",
		color: "white",
		cursor: disabled ? "default" : "pointer",
		opacity: disabled ? 0.3 : 1,
		fontSize: 18,
		fontFamily: "inherit",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 0,
	};
}

interface ThumbProps {
	slide: ShapeData;
	index: number;
	active: boolean;
	onClick: () => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
}

function SlideThumb({ slide, index, active, onClick, onMoveUp, onMoveDown }: ThumbProps) {
	const colorA = SLIDE_USER_COLORS[index % SLIDE_USER_COLORS.length];
	const colorB = SLIDE_USER_COLORS[(index + 2) % SLIDE_USER_COLORS.length];
	const title = getFrameLabel(slide);
	return (
		<div
			style={{
				cursor: "pointer",
				borderRadius: 8,
				overflow: "hidden",
				border: active ? "2px solid var(--brand-violet)" : "1px solid var(--border-subtle)",
				background: "var(--bg-canvas)",
			}}
		>
			<button
				type="button"
				onClick={onClick}
				style={{
					appearance: "none",
					border: "none",
					background: "transparent",
					cursor: "pointer",
					padding: 0,
					width: "100%",
					textAlign: "left",
					color: "inherit",
					fontFamily: "inherit",
				}}
			>
				<div
					style={{
						aspectRatio: "16 / 9",
						background: `linear-gradient(135deg, ${colorA}, ${colorB})`,
						position: "relative",
					}}
				>
					<div
						style={{
							position: "absolute",
							left: 6,
							top: 4,
							fontSize: 9,
							color: "rgba(255,255,255,.7)",
							fontFamily: "var(--font-mono, monospace)",
						}}
					>
						{String(index + 1).padStart(2, "0")}
					</div>
				</div>
				<div
					style={{
						padding: "6px 8px",
						fontSize: 11,
						color: "var(--fg-primary)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
					title={title}
				>
					{title}
				</div>
			</button>
			{(onMoveUp || onMoveDown) && (
				<div style={{ display: "flex", gap: 4, padding: "0 6px 6px" }}>
					<button
						type="button"
						disabled={!onMoveUp}
						onClick={onMoveUp}
						style={miniBtn(!onMoveUp)}
						aria-label="スライドを前に移動"
					>
						↑
					</button>
					<button
						type="button"
						disabled={!onMoveDown}
						onClick={onMoveDown}
						style={miniBtn(!onMoveDown)}
						aria-label="スライドを後に移動"
					>
						↓
					</button>
				</div>
			)}
		</div>
	);
}

function miniBtn(disabled: boolean): React.CSSProperties {
	return {
		appearance: "none",
		flex: 1,
		border: "1px solid var(--border-subtle)",
		background: "transparent",
		color: "var(--fg-secondary)",
		cursor: disabled ? "default" : "pointer",
		opacity: disabled ? 0.3 : 1,
		padding: "2px 0",
		fontSize: 10,
		borderRadius: 4,
		fontFamily: "inherit",
	};
}

function getFrameLabel(shape: ShapeData): string {
	const frameTitle = (shape as unknown as { frameTitle?: unknown }).frameTitle;
	if (typeof frameTitle === "string" && frameTitle.trim()) return frameTitle;
	const name = (shape as unknown as { name?: unknown }).name;
	if (typeof name === "string" && name.trim()) return name;
	return "(無題)";
}

/**
 * 新しいスライド (Frame) を追加する。
 * 位置は現在最後のスライドの横に並べ、サイズは 1280x720 (16:9)。
 */
function addSlide(store: BoardStore, commands: CommandRegistry): void {
	const existing = store.getShapesSorted().filter((s) => s.type === "frame");
	const width = 1280;
	const height = 720;
	let x = 0;
	let y = 0;
	const last = existing[existing.length - 1];
	if (last) {
		x = last.x + last.width + 80;
		y = last.y;
	}
	const id = `frame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const lastZ = last && typeof last.zIndex === "string" ? last.zIndex : null;
	const newZ = zIndexBetween(lastZ, null);
	const snapshot: ShapeData = {
		id,
		type: "frame",
		x,
		y,
		width,
		height,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 1, opacity: 1 },
		zIndex: newZ,
		frameTitle: `スライド ${existing.length + 1}`,
	} as ShapeData;
	const command: Command = {
		execute() {
			store.addShape(snapshot);
		},
		undo() {
			store.deleteShape(id);
		},
	};
	commands.execute(command);
}

function moveSlide(
	store: BoardStore,
	commands: CommandRegistry,
	shapeId: string,
	direction: -1 | 1,
): void {
	const slides = store.getShapesSorted().filter((s) => s.type === "frame");
	const index = slides.findIndex((s) => s.id === shapeId);
	if (index < 0) return;
	const newIndex = index + direction;
	if (newIndex < 0 || newIndex >= slides.length) return;
	const current = slides[index];
	if (!current || typeof current.zIndex !== "string") return;
	let lower: string | null;
	let upper: string | null;
	if (direction === 1) {
		const after = slides[newIndex];
		const afterNext = slides[newIndex + 1];
		if (!after || typeof after.zIndex !== "string") return;
		lower = after.zIndex;
		upper =
			afterNext && typeof afterNext.zIndex === "string" && afterNext.id !== shapeId
				? afterNext.zIndex
				: null;
	} else {
		const before = slides[newIndex];
		const beforePrev = slides[newIndex - 1];
		if (!before || typeof before.zIndex !== "string") return;
		lower =
			beforePrev && typeof beforePrev.zIndex === "string" && beforePrev.id !== shapeId
				? beforePrev.zIndex
				: null;
		upper = before.zIndex;
	}
	const nextKey = zIndexBetween(lower, upper);
	const prevKey = current.zIndex;
	const command: Command = {
		execute() {
			store.updateShape(shapeId, { zIndex: nextKey });
		},
		undo() {
			store.updateShape(shapeId, { zIndex: prevKey });
		},
	};
	commands.execute(command);
}
