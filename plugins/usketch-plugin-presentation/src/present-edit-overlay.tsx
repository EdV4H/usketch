import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { computeMinimap, zIndexBetween } from "@edv4h/usketch-shared";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
	// サムネ再描画用のリビジョン。shape が追加/更新/削除されたら bump。
	const [storeRev, setStoreRev] = useState(0);
	useEffect(() => {
		let scheduled = false;
		const unsub = store.onMutation(() => {
			if (scheduled) return;
			scheduled = true;
			requestAnimationFrame(() => {
				scheduled = false;
				setStoreRev((r) => r + 1);
			});
		});
		return unsub;
	}, [store]);

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

	// Canvas 自体が stage 矩形に縮退しているので、SlideNavigator の fitToBounds が
	// そのまま正しく動く。mode 突入時や stage リサイズ時にだけ nav 経由で再フィットする。
	useEffect(() => {
		const slide = slides[current];
		if (!slide) return;
		const key = `${slide.id}:${Math.round(stage.width)}x${Math.round(stage.height)}`;
		if (lastFitRef.current === key) return;
		lastFitRef.current = key;
		nav.gotoIndex(current);
	}, [slides, current, stage, nav]);

	const startPresent = () => {
		const url = new URL(window.location.href);
		url.searchParams.set("present", "1");
		url.searchParams.set("mode", "present");
		window.history.replaceState(null, "", url.toString());
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	const exitToBoard = () => navigateToBoard();

	const total = slides.length;

	// Canvas layer として render されるが、apps/web 側で Canvas コンテナを
	// プレゼン編集の stage 矩形に縮退させているため、Canvas 内に描画されると
	// overlay 自体も縮小されてしまう。Portal で document.body 直下に逃がし、
	// ウィンドウ全体を基準とした配置に保つ。
	return createPortal(
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 500,
				pointerEvents: "none",
				fontFamily: "var(--font-sans, system-ui)",
			}}
		>
			{/* ステージ枠は apps/web 側で Canvas 本体に box-shadow を当てて描画。
			    ここではサイドバー / 上部 pill / ページャーのみを重ねる。 */}

			{/* サイドバー (画面左端に貼り付け、モック準拠で不透明 bg-canvas-2) */}
			<aside
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					bottom: 0,
					width: SIDEBAR_WIDTH,
					background: "var(--bg-canvas-2)",
					borderRight: "1px solid var(--border-subtle)",
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
							store={store}
							storeRev={storeRev}
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

			{/* ページネーション pill: 画面最下部に固定 (発表モードと同じデザイン) */}
			<div
				style={{
					position: "absolute",
					left: SIDEBAR_RESERVED + (window.innerWidth - SIDEBAR_RESERVED) / 2,
					bottom: 14,
					transform: "translateX(-50%)",
					display: "flex",
					justifyContent: "center",
					pointerEvents: "none",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 2,
						padding: 4,
						borderRadius: 999,
						background: "rgba(20,20,25,0.85)",
						backdropFilter: "blur(20px)",
						WebkitBackdropFilter: "blur(20px)",
						border: "1px solid rgba(255,255,255,0.1)",
						boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
						pointerEvents: "auto",
					}}
				>
					<PagerChevron
						disabled={current === 0}
						onClick={() => nav.prev()}
						ariaLabel="前のスライド"
						direction="prev"
					/>
					<div
						style={{
							padding: "0 12px",
							fontSize: 13,
							fontFamily: "var(--font-mono, monospace)",
							letterSpacing: 0,
							minWidth: 60,
							textAlign: "center",
						}}
					>
						<span style={{ color: "white", fontWeight: 600 }}>{total === 0 ? 0 : current + 1}</span>
						<span style={{ color: "rgba(255,255,255,0.5)" }}> / {total}</span>
					</div>
					<PagerChevron
						disabled={current >= total - 1}
						onClick={() => nav.next()}
						ariaLabel="次のスライド"
						direction="next"
					/>
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
		</div>,
		document.body,
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

function PagerChevron({
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

interface ThumbProps {
	slide: ShapeData;
	index: number;
	active: boolean;
	onClick: () => void;
	store: BoardStore;
	storeRev: number;
}

const THUMB_W = 200;
const THUMB_H = 112; // 16:9

/**
 * スライド frame の中身を縮小してサムネに描画する。
 * `computeMinimap` でボード全体と同じ pipeline を共有し、frame bbox 内の
 * shape を minimap 矩形に畳んで SVG 化する。空スライドはグラデ背景にフォールバック。
 */
function SlideThumb({ slide, index, active, onClick, store, storeRev }: ThumbProps) {
	const title = getFrameLabel(slide);

	// biome-ignore lint/correctness/useExhaustiveDependencies: storeRev 経由で shape mutation に追随する
	const thumb = useMemo(() => {
		const frameBounds = {
			x: slide.x,
			y: slide.y,
			width: slide.width,
			height: slide.height,
		};
		// storeRev を参照するだけで mutation 後に再計算されるようにする (実体は store から読む)
		void storeRev;
		const all = store.getShapesSorted();
		const inside: ShapeData[] = [];
		for (const s of all) {
			if (s.id === slide.id) continue;
			if (s.type === "frame") continue;
			if (rectsIntersect(s, frameBounds)) inside.push(s);
		}
		return computeMinimap({
			shapes: inside,
			viewportWorld: frameBounds,
			mapWidth: THUMB_W,
			mapHeight: THUMB_H,
			padding: 0,
			minSize: 1.5,
		});
	}, [slide.id, slide.x, slide.y, slide.width, slide.height, store, storeRev]);

	const isEmpty = thumb.rects.length === 0;

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
						position: "relative",
						background: "#ffffff",
						overflow: "hidden",
					}}
				>
					{!isEmpty && (
						<svg
							width="100%"
							height="100%"
							viewBox={`0 0 ${THUMB_W} ${THUMB_H}`}
							preserveAspectRatio="xMidYMid meet"
							aria-hidden="true"
							style={{ display: "block" }}
						>
							<title>{title}</title>
							{thumb.rects.map((r) => (
								<rect
									key={r.id}
									x={r.x}
									y={r.y}
									width={r.width}
									height={r.height}
									fill={r.fill}
									stroke="rgba(0,0,0,0.25)"
									strokeWidth={0.6}
									opacity={0.92}
									rx={1}
								/>
							))}
						</svg>
					)}
					<div
						style={{
							position: "absolute",
							left: 6,
							top: 4,
							fontSize: 9,
							color: "var(--fg-tertiary)",
							fontFamily: "var(--font-mono, monospace)",
							mixBlendMode: "multiply",
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
		</div>
	);
}

function rectsIntersect(
	a: { x: number; y: number; width: number; height: number },
	b: { x: number; y: number; width: number; height: number },
): boolean {
	return !(
		a.x + a.width <= b.x ||
		b.x + b.width <= a.x ||
		a.y + a.height <= b.y ||
		b.y + b.height <= a.y
	);
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
