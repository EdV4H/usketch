import type { AppInstance } from "@edv4h/usketch-core";
import type { PluginAction } from "@edv4h/usketch-shared";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { I, Kbd } from "./ui/index.js";

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
	app: AppInstance;
}

/** Default arg map for a param action so it can be fired from the palette. */
function defaultArgs(action: PluginAction): Record<string, unknown> {
	const args: Record<string, unknown> = {};
	for (const p of action.params ?? []) {
		if (p.default !== undefined) args[p.name] = p.default;
	}
	return args;
}

/**
 * コマンドパレット（⌘K）。共有アクションレジストリ（{@link AppInstance.actions}）を
 * 単一ソースとして、登録済みの全アクション（プラグイン + アプリ横断操作）をあいまい
 * 検索して発火する。Control HUD の Controls ドックと同じレジストリを参照する。
 */
export function CommandPalette({ open, onClose, app }: CommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	// レジストリの register/unregister に追従して再描画。
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => app.actions.subscribe(bump), [app.actions]);

	const entries = app.actions.getOrdered();

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const list = entries.map((e) => e.action);
		if (!q) return list;
		return list.filter((a) => `${a.label} ${a.group ?? ""} ${a.id}`.toLowerCase().includes(q));
	}, [entries, query]);

	const grouped = useMemo(() => {
		const map = new Map<string, PluginAction[]>();
		for (const a of filtered) {
			const g = a.group ?? "Actions";
			const arr = map.get(g) ?? [];
			arr.push(a);
			map.set(g, arr);
		}
		return Array.from(map.entries());
	}, [filtered]);

	useEffect(() => {
		if (open) {
			setQuery("");
			setActiveIndex(0);
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [open]);

	const runAt = useCallback(
		(idx: number) => {
			const action = filtered[idx];
			if (!action) return;
			if (action.isEnabled && !action.isEnabled()) return;
			onClose();
			void action.run(defaultArgs(action));
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
			{items.map((a) => {
				const idx = globalIndex++;
				const active = idx === activeIndex;
				const enabled = a.isEnabled ? a.isEnabled() : true;
				const on = a.isActive?.() ?? false;
				return (
					<button
						key={a.id}
						type="button"
						disabled={!enabled}
						onClick={() => runAt(idx)}
						onMouseEnter={() => setActiveIndex(idx)}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							padding: "8px 16px",
							background: active ? "var(--bg-hover)" : "transparent",
							cursor: enabled ? "pointer" : "default",
							opacity: enabled ? 1 : 0.4,
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
								color: group === "AI" ? "var(--brand-violet)" : "var(--fg-secondary)",
								flexShrink: 0,
							}}
						>
							{a.icon ? a.icon() : <I.sparkles size={14} />}
						</div>
						<div style={{ flex: 1, fontSize: 13 }}>{a.label}</div>
						{on && (
							<span
								style={{
									width: 7,
									height: 7,
									borderRadius: "50%",
									background: "var(--brand-violet)",
								}}
							/>
						)}
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
						placeholder="何をしますか？（アクションを検索）"
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
