import type { AppInstance } from "@edv4h/usketch-core";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { setTheme } from "../lib/theme.js";
import { I, type IconComponent, Kbd } from "./ui/index.js";

interface CommandItem {
	id: string;
	group: string;
	label: string;
	icon: IconComponent;
	shortcut?: string;
	hint?: string;
	run: () => void;
}

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
	app: AppInstance;
	boardId?: string;
	isCloudBoard: boolean;
}

export function CommandPalette({ open, onClose, app, boardId, isCloudBoard }: CommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);

	const commands = useMemo<CommandItem[]>(() => {
		const list: CommandItem[] = [];

		if (isCloudBoard) {
			list.push(
				{
					id: "ai.summarize",
					group: "AI",
					label: "このボードを要約",
					icon: I.sparkles,
					hint: "AI",
					run: () => app.events.emit("ai:request", { prompt: "このボードの内容を要約して" }),
				},
				{
					id: "ai.align",
					group: "AI",
					label: "フローチャートを整列する",
					icon: I.wand,
					hint: "AI",
					run: () => app.events.emit("ai:request", { prompt: "フローチャートを整列して" }),
				},
				{
					id: "ai.translate",
					group: "AI",
					label: "選択を英語に翻訳",
					icon: I.translate,
					hint: "AI",
					run: () => app.events.emit("ai:request", { prompt: "選択を英語に翻訳して" }),
				},
				{
					id: "ai.image",
					group: "AI",
					label: "画像を生成…",
					icon: I.image,
					hint: "AI",
					run: () => app.events.emit("ai:image:open", {}),
				},
			);
		}

		list.push(
			{
				id: "action.frame",
				group: "アクション",
				label: "フレームを追加",
				icon: I.frame,
				shortcut: "F",
				run: () => app.store.setActiveToolId("frame"),
			},
			{
				id: "action.undo",
				group: "アクション",
				label: "元に戻す",
				icon: I.undo,
				shortcut: "⌘Z",
				run: () => app.commands.undo(),
			},
			{
				id: "action.redo",
				group: "アクション",
				label: "やり直す",
				icon: I.redo,
				shortcut: "⌘⇧Z",
				run: () => app.commands.redo(),
			},
		);

		if (isCloudBoard && boardId) {
			list.push({
				id: "action.present",
				group: "アクション",
				label: "プレゼンテーションを開始",
				icon: I.present,
				shortcut: "⌘⇧P",
				run: () => navigate(`/boards/${boardId}?present=1`),
			});
		}

		list.push(
			{
				id: "theme.light",
				group: "テーマ",
				label: "テーマ切替: ライト",
				icon: I.sun,
				run: () => setTheme("light"),
			},
			{
				id: "theme.dark",
				group: "テーマ",
				label: "テーマ切替: ダーク",
				icon: I.moon,
				run: () => setTheme("dark"),
			},
			{
				id: "theme.system",
				group: "テーマ",
				label: "テーマ切替: システム",
				icon: I.monitor,
				run: () => setTheme("system"),
			},
		);

		list.push(
			{
				id: "nav.dashboard",
				group: "移動",
				label: "ダッシュボードへ戻る",
				icon: I.home,
				run: () => navigate("/dashboard"),
			},
			{
				id: "nav.community",
				group: "移動",
				label: "コミュニティマップ",
				icon: I.community,
				run: () => navigate("/community"),
			},
		);

		return list;
	}, [app, boardId, isCloudBoard, navigate]);

	const filtered = useMemo(() => {
		if (!query) return commands;
		const q = query.toLowerCase();
		return commands.filter((c) => c.label.toLowerCase().includes(q));
	}, [commands, query]);

	const grouped = useMemo(() => {
		const map = new Map<string, CommandItem[]>();
		for (const c of filtered) {
			const g = map.get(c.group) ?? [];
			g.push(c);
			map.set(c.group, g);
		}
		return Array.from(map.entries());
	}, [filtered]);

	useEffect(() => {
		if (open) {
			setQuery("");
			setActiveIndex(0);
			// 次のフレームで focus（animation 開始前に focus が外れるのを防ぐ）
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	useEffect(() => {
		setActiveIndex(0);
	}, []);

	const runAt = useCallback(
		(idx: number) => {
			const item = filtered[idx];
			if (!item) return;
			onClose();
			item.run();
		},
		[filtered, onClose],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((i) => Math.max(i - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				runAt(activeIndex);
			} else if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[activeIndex, filtered.length, runAt, onClose],
	);

	if (!open) return null;

	let globalIndex = 0;
	const groupBlocks: ReactNode[] = grouped.map(([group, items]) => (
		<div key={group}>
			<div
				style={{
					padding: "10px 16px 4px",
					fontSize: 10.5,
					fontWeight: 600,
					color: "var(--fg-tertiary)",
					textTransform: "uppercase",
					letterSpacing: 0.4,
				}}
			>
				{group}
			</div>
			{items.map((c) => {
				const idx = globalIndex++;
				const active = idx === activeIndex;
				return (
					<button
						key={c.id}
						type="button"
						onClick={() => runAt(idx)}
						onMouseEnter={() => setActiveIndex(idx)}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							padding: "8px 16px",
							background: active ? "var(--bg-hover)" : "transparent",
							cursor: "pointer",
							width: "100%",
							border: "none",
							color: "var(--fg-primary)",
							textAlign: "left",
							fontFamily: "inherit",
							fontSize: "inherit",
						}}
					>
						<div
							style={{
								width: 26,
								height: 26,
								borderRadius: 6,
								background: "var(--bg-input)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: c.group === "AI" ? "var(--brand-violet)" : "var(--fg-secondary)",
							}}
						>
							<c.icon size={14} />
						</div>
						<div style={{ flex: 1, fontSize: 13 }}>{c.label}</div>
						{c.hint && (
							<span
								style={{
									fontSize: 10,
									color: "var(--brand-violet)",
									background: "var(--bg-active)",
									padding: "2px 6px",
									borderRadius: 4,
									fontWeight: 600,
								}}
							>
								{c.hint}
							</span>
						)}
						{c.shortcut && <Kbd>{c.shortcut}</Kbd>}
					</button>
				);
			})}
		</div>
	));

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: 背景クリックで閉じる標準的なモーダルパターン
		<div
			onClick={onClose}
			onKeyDown={onKeyDown}
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0, 0, 0, 0.5)",
				backdropFilter: "blur(8px)",
				WebkitBackdropFilter: "blur(8px)",
				zIndex: 1000,
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
			}}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: キーボード操作は親 div の onKeyDown で処理 */}
			<div
				role="dialog"
				aria-label="コマンドパレット"
				aria-modal="true"
				onClick={(e) => e.stopPropagation()}
				className="u-surface u-anim-in"
				style={{
					width: 580,
					maxHeight: "70vh",
					marginTop: "10vh",
					borderRadius: 14,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					background: "var(--bg-surface-raised)",
					boxShadow: "var(--shadow-3), var(--shadow-glow)",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "14px 16px",
						borderBottom: "1px solid var(--border-subtle)",
					}}
				>
					<div
						style={{
							width: 22,
							height: 22,
							borderRadius: 6,
							background: "var(--brand-gradient)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
						}}
					>
						<I.sparkles size={13} />
					</div>
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setActiveIndex(0);
						}}
						placeholder="何をしますか？"
						style={{
							flex: 1,
							background: "transparent",
							border: "none",
							color: "var(--fg-primary)",
							fontSize: 15,
							outline: "none",
							fontFamily: "inherit",
							padding: "4px 0",
							letterSpacing: "-0.01em",
						}}
					/>
					<Kbd>esc</Kbd>
				</div>
				<div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
					{groupBlocks}
					{filtered.length === 0 && (
						<div
							style={{
								padding: "30px 20px",
								textAlign: "center",
								color: "var(--fg-tertiary)",
								fontSize: 13,
							}}
						>
							コマンドが見つかりません
						</div>
					)}
				</div>
				<div
					style={{
						padding: "8px 16px",
						borderTop: "1px solid var(--border-subtle)",
						display: "flex",
						gap: 14,
						fontSize: 11,
						color: "var(--fg-tertiary)",
						background: "var(--bg-canvas-2)",
					}}
				>
					<span>
						<Kbd>↑↓</Kbd> 移動
					</span>
					<span>
						<Kbd>↵</Kbd> 実行
					</span>
					<span>
						<Kbd>esc</Kbd> 閉じる
					</span>
				</div>
			</div>
		</div>
	);
}

/**
 * Cmd+K / Ctrl+K のグローバルキーハンドラを登録するフック。
 * CommandPalette を親コンポーネントで open 制御してから onOpen で呼ばれる。
 */
export function useCommandPaletteShortcut(onOpen: () => void): void {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpen();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onOpen]);
}
