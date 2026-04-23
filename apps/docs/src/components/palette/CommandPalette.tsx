import { Command } from "cmdk";
import { useEffect, useMemo, useState } from "react";

export interface PaletteItem {
	id: string;
	title: string;
	group: "Docs" | "Plugins" | "Pages" | "Actions";
	href?: string;
	action?: string;
	hint?: string;
}

interface Props {
	items: PaletteItem[];
}

export default function CommandPalette({ items }: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((o) => !o);
				return;
			}
			if (e.key === "Escape") setOpen(false);
		}
		function openHandler() {
			setOpen(true);
		}
		window.addEventListener("keydown", handler);
		window.addEventListener("usketch:open-palette", openHandler);
		const triggers = document.querySelectorAll<HTMLButtonElement>("[data-open-palette]");
		for (const b of triggers) b.addEventListener("click", openHandler);
		return () => {
			window.removeEventListener("keydown", handler);
			window.removeEventListener("usketch:open-palette", openHandler);
			for (const b of triggers) b.removeEventListener("click", openHandler);
		};
	}, []);

	const grouped = useMemo(() => {
		const groups: Record<string, PaletteItem[]> = {};
		for (const item of items) {
			groups[item.group] ??= [];
			groups[item.group].push(item);
		}
		return groups;
	}, [items]);

	function runAction(action: string) {
		switch (action) {
			case "toggle-theme": {
				const html = document.documentElement;
				const next = html.dataset.theme === "light" ? "dark" : "light";
				html.dataset.theme = next;
				try {
					localStorage.setItem("usketch-theme", next);
				} catch {}
				break;
			}
			case "open-tweaks":
				window.dispatchEvent(new CustomEvent("usketch:open-tweaks"));
				break;
		}
	}

	function select(item: PaletteItem) {
		setOpen(false);
		if (item.href) {
			window.location.assign(item.href);
		} else if (item.action) {
			runAction(item.action);
		}
	}

	if (!open) return null;

	return (
		<div className="palette-backdrop">
			<button
				type="button"
				aria-label="Close command palette"
				className="palette-backdrop__dismiss"
				onClick={() => setOpen(false)}
			/>
			<div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
				<Command label="Command palette" shouldFilter>
					<div className="palette__input-row">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<circle cx="11" cy="11" r="7" />
							<path d="M21 21l-4.3-4.3" />
						</svg>
						<Command.Input
							autoFocus
							value={query}
							onValueChange={setQuery}
							placeholder="Search docs, plugins, actions…"
						/>
						<kbd className="palette__kbd">esc</kbd>
					</div>
					<Command.List>
						<Command.Empty>No results.</Command.Empty>
						{Object.entries(grouped).map(([group, groupItems]) => (
							<Command.Group key={group} heading={group}>
								{groupItems.map((item) => (
									<Command.Item
										key={item.id}
										value={`${item.title} ${item.group} ${item.id}`}
										onSelect={() => select(item)}
									>
										<span className="palette__row-label">{item.title}</span>
										{item.hint && <span className="palette__row-hint">{item.hint}</span>}
										<span className="palette__row-enter" aria-hidden="true">
											↵
										</span>
									</Command.Item>
								))}
							</Command.Group>
						))}
					</Command.List>
				</Command>
			</div>

			<style>{`
				.palette-backdrop {
					position: fixed;
					inset: 0;
					z-index: 100;
					background: rgba(0, 0, 0, 0.55);
					backdrop-filter: blur(6px);
					display: flex;
					justify-content: center;
					align-items: flex-start;
					padding-top: 14vh;
				}
				.palette-backdrop__dismiss {
					position: absolute;
					inset: 0;
					background: transparent;
					border: 0;
					padding: 0;
					cursor: pointer;
				}
				.palette {
					position: relative;
					width: 560px;
					max-width: calc(100vw - 32px);
					background: var(--bg-surface);
					backdrop-filter: blur(28px) saturate(1.4);
					-webkit-backdrop-filter: blur(28px) saturate(1.4);
					border: 1px solid var(--border-default);
					border-radius: var(--r-lg);
					box-shadow: var(--shadow-3);
					overflow: hidden;
				}
				.palette [cmdk-input] {
					flex: 1;
					background: transparent;
					border: none;
					outline: none;
					color: var(--fg-primary);
					font: inherit;
					font-size: 15px;
					padding: 0;
				}
				.palette__input-row {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 14px 16px;
					border-bottom: 1px solid var(--border-subtle);
					color: var(--fg-secondary);
				}
				.palette__kbd {
					font-family: var(--font-mono);
					font-size: 10.5px;
					padding: 2px 6px;
					border: 1px solid var(--border-subtle);
					border-radius: 4px;
					color: var(--fg-tertiary);
				}
				.palette [cmdk-list] {
					max-height: 420px;
					overflow-y: auto;
					padding: 6px;
				}
				.palette [cmdk-group-heading] {
					font-size: 10.5px;
					text-transform: uppercase;
					letter-spacing: 0.08em;
					color: var(--fg-tertiary);
					padding: 10px 10px 6px;
				}
				.palette [cmdk-item] {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 9px 10px;
					border-radius: var(--r-sm);
					color: var(--fg-primary);
					font-size: 14px;
					cursor: pointer;
					user-select: none;
				}
				.palette [cmdk-item][data-selected="true"] {
					background: var(--bg-active);
				}
				.palette [cmdk-empty] {
					padding: var(--space-6);
					text-align: center;
					color: var(--fg-tertiary);
					font-size: 13px;
				}
				.palette__row-label { flex: 1; }
				.palette__row-hint {
					font-size: 11.5px;
					color: var(--fg-tertiary);
				}
				.palette__row-enter {
					font-size: 14px;
					color: var(--fg-tertiary);
				}
			`}</style>
		</div>
	);
}
