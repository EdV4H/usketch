import type {
	BoardStore,
	Command,
	CommandRegistry,
	LayerRenderContext,
	ShapeData,
} from "@edv4h/usketch-shared";
import { zIndexBetween } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import type { SlideNavigator } from "./slide-navigator.js";

interface Props {
	nav: SlideNavigator;
	store: BoardStore;
	commands: CommandRegistry;
	renderCtx: LayerRenderContext;
	navigateToBoard: () => void;
}

export function SlideOutlinePanel({
	nav,
	store,
	commands,
	renderCtx: _renderCtx,
	navigateToBoard,
}: Props) {
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

	const exitToBoard = () => navigateToBoard();

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
					aria-label="発表モードに切替"
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
						onMoveUp={i > 0 ? () => moveSlide(store, commands, slide.id, -1) : undefined}
						onMoveDown={
							i < slides.length - 1 ? () => moveSlide(store, commands, slide.id, +1) : undefined
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
					aria-label="スライドを前に移動"
				>
					↑
				</button>
				<button
					type="button"
					disabled={!onMoveDown}
					onClick={onMoveDown}
					style={miniButtonStyle(!onMoveDown)}
					title="後へ"
					aria-label="スライドを後に移動"
				>
					↓
				</button>
			</div>
		</div>
	);
}

function getFrameLabel(shape: ShapeData): string {
	// shape-frame プラグインは `frameTitle` にタイトルを保持する。
	// 念のため `name` にもフォールバックする（他のフレーム系プラグインとの互換）。
	const frameTitle = (shape as unknown as { frameTitle?: unknown }).frameTitle;
	if (typeof frameTitle === "string" && frameTitle.trim()) return frameTitle;
	const name = (shape as unknown as { name?: unknown }).name;
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
 *
 * 注意: store の createBringForwardCommand / createSendBackwardCommand は
 * 「同じ親を持つ shape 全体（非フレーム含む）」の中で隣接 shape と入れ替える。
 * そのためトップレベルに非フレーム shape（ラフ描画など）が混ざっていると
 * 1 クリックでスライド順が動かなかったり、非スライドの描画順まで変わってしまう。
 *
 * ここではスライドとして扱う Frame の一覧（nav.getSlides）の中で前後の Frame の
 * zIndex を参照し、その隙間に zIndexBetween で新キーを差し込む。これにより
 * 非フレーム shape の順序には影響せず、常に 1 クリック = 1 位置の移動になる。
 */
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

	// 新しい位置での前後 Frame の zIndex を取得して、その間に挟むキーを生成
	let lower: string | null;
	let upper: string | null;
	if (direction === 1) {
		// 一つ後ろへ: newIndex の Frame と newIndex+1 の Frame の間に入る
		const after = slides[newIndex];
		const afterNext = slides[newIndex + 1];
		if (!after || typeof after.zIndex !== "string") return;
		lower = after.zIndex;
		upper =
			afterNext && typeof afterNext.zIndex === "string" && afterNext.id !== shapeId
				? afterNext.zIndex
				: null;
	} else {
		// 一つ前へ: newIndex-1 の Frame と newIndex の Frame の間に入る
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
