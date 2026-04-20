import type { BoardStore, LayerRenderContext, ShapeData } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import type { SlideNavigator } from "./slide-navigator.js";

interface Props {
	nav: SlideNavigator;
	store: BoardStore;
	renderCtx: LayerRenderContext;
}

export function SlideOutlinePanel({ nav, store, renderCtx: _renderCtx }: Props) {
	const [slides, setSlides] = useState<ShapeData[]>(nav.getSlides());
	const [current, setCurrent] = useState(nav.getCurrentIndex());

	useEffect(() => {
		const unsub = nav.onChange((i) => {
			setSlides(nav.getSlides());
			setCurrent(i);
		});
		return unsub;
	}, [nav]);

	const startPresent = () => {
		const url = new URL(window.location.href);
		url.searchParams.set("mode", "present");
		window.history.replaceState(null, "", url.toString());
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	const exitToBoard = () => {
		// /presentation/:boardId?... → /boards/:boardId
		const match = window.location.pathname.match(/^\/presentation\/([^/]+)/);
		if (match) {
			window.location.assign(`/boards/${match[1]}`);
		}
	};

	return (
		<div
			style={{
				position: "fixed",
				top: 80,
				left: 8,
				width: 140,
				maxHeight: "calc(100vh - 120px)",
				overflowY: "auto",
				background: "rgba(20,20,24,0.85)",
				color: "white",
				borderRadius: 8,
				padding: 8,
				font: "12px system-ui",
				pointerEvents: "auto",
				zIndex: 100,
				display: "flex",
				flexDirection: "column",
				gap: 6,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<button
					type="button"
					onClick={exitToBoard}
					style={{
						appearance: "none",
						border: "1px solid rgba(255,255,255,0.3)",
						background: "transparent",
						color: "white",
						cursor: "pointer",
						padding: "2px 6px",
						borderRadius: 4,
						fontSize: 11,
					}}
					title="通常のホワイトボードに戻る"
				>
					← ボード
				</button>
				<button
					type="button"
					onClick={startPresent}
					disabled={slides.length === 0}
					style={{
						appearance: "none",
						border: "1px solid rgba(255,255,255,0.3)",
						background: "transparent",
						color: "white",
						cursor: slides.length === 0 ? "default" : "pointer",
						opacity: slides.length === 0 ? 0.4 : 1,
						padding: "2px 8px",
						borderRadius: 4,
						fontSize: 11,
					}}
					title="発表モードに切替"
				>
					▶
				</button>
			</div>
			<div style={{ fontWeight: 600, marginTop: 4 }}>スライド</div>

			{slides.length === 0 ? (
				<div style={{ color: "rgba(255,255,255,0.5)", padding: "8px 0" }}>
					Frame を追加するとスライドになります
				</div>
			) : (
				slides.map((slide, i) => (
					<SlideThumbnail
						key={slide.id}
						slide={slide}
						label={i + 1}
						active={i === current}
						onClick={() => nav.gotoIndex(i)}
						onMoveUp={i > 0 ? () => moveSlide(store, slide, slides, -1) : undefined}
						onMoveDown={
							i < slides.length - 1 ? () => moveSlide(store, slide, slides, +1) : undefined
						}
					/>
				))
			)}
		</div>
	);
}

interface ThumbnailProps {
	slide: ShapeData;
	label: number;
	active: boolean;
	onClick: () => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
}

function SlideThumbnail({ slide, label, active, onClick, onMoveUp, onMoveDown }: ThumbnailProps) {
	return (
		<div
			style={{
				position: "relative",
				border: active ? "2px solid #4f9dff" : "1px solid rgba(255,255,255,0.2)",
				borderRadius: 4,
				background: "rgba(255,255,255,0.05)",
				padding: "4px 6px",
			}}
		>
			<button
				type="button"
				onClick={onClick}
				style={{
					appearance: "none",
					background: "transparent",
					border: "none",
					color: "white",
					cursor: "pointer",
					width: "100%",
					textAlign: "left",
					padding: 0,
					font: "inherit",
				}}
			>
				<div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>#{label}</div>
				<div
					style={{
						fontSize: 12,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
					title={getFrameLabel(slide)}
				>
					{getFrameLabel(slide)}
				</div>
			</button>
			<div style={{ display: "flex", gap: 4, marginTop: 4 }}>
				<button
					type="button"
					disabled={!onMoveUp}
					onClick={onMoveUp}
					style={miniButtonStyle(!onMoveUp)}
					title="前へ"
				>
					↑
				</button>
				<button
					type="button"
					disabled={!onMoveDown}
					onClick={onMoveDown}
					style={miniButtonStyle(!onMoveDown)}
					title="後へ"
				>
					↓
				</button>
			</div>
		</div>
	);
}

function getFrameLabel(shape: ShapeData): string {
	const name = (shape as unknown as { name?: string }).name;
	if (typeof name === "string" && name.trim()) return name;
	return "(無題)";
}

function miniButtonStyle(disabled: boolean): React.CSSProperties {
	return {
		appearance: "none",
		flex: 1,
		border: "1px solid rgba(255,255,255,0.2)",
		background: "rgba(255,255,255,0.05)",
		color: "white",
		cursor: disabled ? "default" : "pointer",
		opacity: disabled ? 0.3 : 1,
		padding: "1px 0",
		fontSize: 10,
		borderRadius: 3,
	};
}

/**
 * スライドを1つ上/下に移動する。
 * z-index は fractional string key なので、隣接スライドのキーから新キーを生成する。
 *
 * NOTE: zIndexBetween のロジックは store の createBringForward/SendBackward と同じだが、
 *       store 側のユーティリティは Command 経由のみ公開されているため、ここでは直接
 *       updateShape を呼んで順序入替を行う。
 */
function moveSlide(
	store: BoardStore,
	slide: ShapeData,
	slides: ShapeData[],
	direction: -1 | 1,
): void {
	const index = slides.findIndex((s) => s.id === slide.id);
	if (index < 0) return;
	const newIndex = index + direction;
	if (newIndex < 0 || newIndex >= slides.length) return;

	// 隣接と入れ替える: 2つの zIndex を swap するだけで全体順序は保たれる
	const a = slides[index];
	const b = slides[newIndex];
	if (!a || !b || typeof a.zIndex !== "string" || typeof b.zIndex !== "string") return;

	store.updateShape(a.id, { zIndex: b.zIndex });
	store.updateShape(b.id, { zIndex: a.zIndex });
}
