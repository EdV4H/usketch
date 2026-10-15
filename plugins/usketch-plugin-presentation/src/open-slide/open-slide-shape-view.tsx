import { isShapeLocked } from "@edv4h/usketch-shared";
import type { CSSProperties, ReactNode } from "react";
import { Component, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { OpenSlideDeckRegistry } from "./deck-registry.js";
import { openSlideDesignToCssVars } from "./design.js";
import type { OpenSlideEditState } from "./edit-state.js";
import { OpenSlidePageProvider } from "./open-slide-context.js";
import { OpenSlideTextContext, type OpenSlideTextContextValue } from "./open-slide-text.js";
import { resolveOpenSlideDesign } from "./overrides.js";
import type { PresentCursor } from "./present-cursor.js";
import {
	OPEN_SLIDE_CANVAS_HEIGHT,
	OPEN_SLIDE_CANVAS_WIDTH,
	type OpenSlideDesign,
	type OpenSlideModule,
	type OpenSlideShapeData,
} from "./types.js";

export interface OpenSlideShapeViewProps {
	shape: OpenSlideShapeData;
	registry: OpenSlideDeckRegistry;
	presentCursor: PresentCursor;
	/** 編集時のページ送り。Shape の `page` を書き換える。 */
	onSetPage: (shapeId: string, page: number) => void;
	/** 中身を編集しているデッキ。ダブルクリックで始まる。 */
	editState: OpenSlideEditState;
	/** `OpenSlideText` の編集を確定する。 */
	onCommitText: (
		shapeId: string,
		params: { page: number; id: string; value: string; defaultValue: string },
	) => void;
}

function clampPage(page: number, total: number): number {
	if (total <= 0) return 0;
	const n = Number.isFinite(page) ? Math.floor(page) : 0;
	return Math.max(0, Math.min(n, total - 1));
}

/** ボード上の open-slide デッキ。現在ページを 1920×1080 で描き、Shape の幅に縮める。 */
export function OpenSlideShapeView({
	shape,
	registry,
	presentCursor,
	onSetPage,
	editState,
	onCommitText,
}: OpenSlideShapeViewProps) {
	const deck = registry.getDeck(shape.deckId);
	const getModule = () => registry.getLoaded(shape.deckId);
	const getError = () => registry.getError(shape.deckId);
	const module = useSyncExternalStore(registry.subscribe, getModule, getModule);
	const error = useSyncExternalStore(registry.subscribe, getError, getError);
	const position = useSyncExternalStore(
		presentCursor.subscribe,
		presentCursor.get,
		presentCursor.get,
	);
	const editingId = useSyncExternalStore(editState.subscribe, editState.get, editState.get);
	const presenting = position?.shapeId === shape.id;
	const editing = editingId === shape.id && !presenting;
	const frameRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!deck) return;
		registry.load(deck.id).catch(() => {
			// 失敗はレジストリの error 状態として描画側で表示する。
		});
	}, [deck, registry]);

	// 編集中は、デッキの外を押すか Esc (文字の入力中は入力の確定だけ) で編集を終える。
	useEffect(() => {
		if (!editing) return;
		const onPointerDown = (e: PointerEvent) => {
			const frame = frameRef.current;
			if (frame && e.target instanceof Node && frame.contains(e.target)) return;
			editState.end(shape.id);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") editState.end(shape.id);
		};
		window.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [editing, editState, shape.id]);

	const design = useMemo(
		() => resolveOpenSlideDesign(module?.design, shape.overrides),
		[module, shape.overrides],
	);
	const textContext = useMemo<Omit<OpenSlideTextContextValue, "page">>(
		() => ({
			text: shape.overrides?.text,
			editing,
			commit: (params) => onCommitText(shape.id, params),
		}),
		[shape.overrides?.text, editing, onCommitText, shape.id],
	);

	if (!deck) {
		return <Placeholder shape={shape}>デッキ「{shape.deckId}」が見つかりません</Placeholder>;
	}
	if (error !== undefined) {
		return <Placeholder shape={shape}>「{deck.title}」を読み込めませんでした</Placeholder>;
	}
	if (!module) {
		return <Placeholder shape={shape}>「{deck.title}」を読み込み中…</Placeholder>;
	}

	const total = module.default.length;
	const page = clampPage(presenting ? position.step : shape.page, total);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: ボード上のデッキ。ダブルクリックで中身の編集を始める
		<div
			ref={frameRef}
			style={frameStyle(design, editing)}
			onDoubleClick={(e) => {
				if (presenting || isShapeLocked(shape)) return;
				e.stopPropagation();
				editState.begin(shape.id);
			}}
		>
			<ScaledPage
				module={module}
				design={design}
				page={page}
				total={total}
				scale={shape.width / OPEN_SLIDE_CANVAS_WIDTH}
				active={presenting}
				textContext={textContext}
			/>
			{!presenting && total > 1 && (
				<PageControls
					shape={shape}
					page={page}
					total={total}
					onSetPage={(next) => onSetPage(shape.id, next)}
				/>
			)}
		</div>
	);
}

function frameStyle(design: OpenSlideDesign | undefined, editing: boolean): CSSProperties {
	return {
		position: "relative",
		width: "100%",
		height: "100%",
		overflow: "hidden",
		background: design?.palette.bg ?? "#ffffff",
		boxShadow: editing
			? "0 0 0 3px rgba(59,130,246,0.85), 0 1px 4px rgba(0,0,0,0.18)"
			: "0 1px 4px rgba(0,0,0,0.18)",
	};
}

interface ScaledPageProps {
	module: OpenSlideModule;
	/** 配色の差し替えを重ねた design。 */
	design: OpenSlideDesign | undefined;
	page: number;
	total: number;
	scale: number;
	active: boolean;
	textContext: Omit<OpenSlideTextContextValue, "page">;
}

function ScaledPage({ module, design, page, total, scale, active, textContext }: ScaledPageProps) {
	const Page = module.default[page];
	const designVars = design ? openSlideDesignToCssVars(design) : {};
	const pageTextContext = useMemo(() => ({ ...textContext, page }), [textContext, page]);
	return (
		<div
			data-open-slide-canvas=""
			style={
				{
					...designVars,
					position: "absolute",
					left: 0,
					top: 0,
					width: OPEN_SLIDE_CANVAS_WIDTH,
					height: OPEN_SLIDE_CANVAS_HEIGHT,
					transform: `scale(${scale})`,
					transformOrigin: "0 0",
					overflow: "hidden",
					color: design ? "var(--osd-text)" : "#000000",
					// ページ内の要素はボードの選択・ドラッグを奪わないように操作不可にする。
					// 編集中も OpenSlideText だけが自分で pointer-events を戻して入力を受ける。
					pointerEvents: "none",
				} as CSSProperties
			}
		>
			{Page && (
				<PageErrorBoundary key={page}>
					<OpenSlidePageProvider index={page} total={total} active={active}>
						<OpenSlideTextContext.Provider value={pageTextContext}>
							<Page />
						</OpenSlideTextContext.Provider>
					</OpenSlidePageProvider>
				</PageErrorBoundary>
			)}
		</div>
	);
}

interface PageControlsProps {
	shape: OpenSlideShapeData;
	page: number;
	total: number;
	onSetPage: (page: number) => void;
}

function PageControls({ shape, page, total, onSetPage }: PageControlsProps) {
	// ボードのズームに合わせて縮むので、Shape の幅に比例させて読める大きさを保つ。
	const size = Math.max(12, shape.width * 0.022);
	const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
	return (
		<div
			style={{
				position: "absolute",
				right: size * 0.6,
				bottom: size * 0.6,
				display: "flex",
				alignItems: "center",
				gap: size * 0.3,
				padding: `${size * 0.2}px ${size * 0.4}px`,
				borderRadius: 999,
				background: "rgba(20,20,25,0.72)",
				color: "#ffffff",
				fontSize: size,
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
				pointerEvents: "auto",
			}}
		>
			<PageButton
				label="前のページ"
				size={size}
				disabled={page <= 0}
				onPointerDown={stop}
				onClick={(e) => {
					stop(e);
					onSetPage(page - 1);
				}}
			>
				‹
			</PageButton>
			<span style={{ fontVariantNumeric: "tabular-nums" }}>
				{page + 1} / {total}
			</span>
			<PageButton
				label="次のページ"
				size={size}
				disabled={page >= total - 1}
				onPointerDown={stop}
				onClick={(e) => {
					stop(e);
					onSetPage(page + 1);
				}}
			>
				›
			</PageButton>
		</div>
	);
}

interface PageButtonProps {
	label: string;
	size: number;
	disabled: boolean;
	onPointerDown: (e: { stopPropagation: () => void }) => void;
	onClick: (e: { stopPropagation: () => void }) => void;
	children: ReactNode;
}

function PageButton({ label, size, disabled, onPointerDown, onClick, children }: PageButtonProps) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onPointerDown={onPointerDown}
			onClick={onClick}
			style={{
				width: size * 1.6,
				height: size * 1.6,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				border: "none",
				borderRadius: 999,
				background: "transparent",
				color: "inherit",
				fontSize: size * 1.2,
				lineHeight: 1,
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.35 : 1,
			}}
		>
			{children}
		</button>
	);
}

function Placeholder({ shape, children }: { shape: OpenSlideShapeData; children: ReactNode }) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				boxSizing: "border-box",
				background: "#f4f4f5",
				border: "1px dashed #a1a1aa",
				color: "#52525b",
				fontSize: Math.max(12, shape.width * 0.025),
				fontFamily: "system-ui, sans-serif",
				textAlign: "center",
			}}
		>
			{children}
		</div>
	);
}

interface PageErrorBoundaryState {
	error: unknown;
}

/** デッキのページが throw してもボード全体を巻き込まないための境界。 */
class PageErrorBoundary extends Component<{ children: ReactNode }, PageErrorBoundaryState> {
	state: PageErrorBoundaryState = { error: undefined };

	static getDerivedStateFromError(error: unknown): PageErrorBoundaryState {
		return { error };
	}

	render() {
		if (this.state.error !== undefined) {
			return (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "#fef2f2",
						color: "#991b1b",
						fontSize: 48,
						fontFamily: "system-ui, sans-serif",
					}}
				>
					このページを表示できませんでした
				</div>
			);
		}
		return this.props.children;
	}
}
