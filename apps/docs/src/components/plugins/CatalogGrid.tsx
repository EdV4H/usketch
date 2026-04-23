import MiniSearch from "minisearch";
import { useMemo, useState } from "react";

export interface Plugin {
	id: string;
	name: string;
	category: string;
	glyph?: string;
	summary: string;
	jpName?: string;
	jpSummary?: string;
}

interface Category {
	id: string;
	label: string;
	jpLabel?: string;
}

interface Props {
	plugins: Plugin[];
	categories: Category[];
	basePath: string;
}

export default function CatalogGrid({ plugins, categories, basePath }: Props) {
	const [query, setQuery] = useState("");
	const [active, setActive] = useState<Set<string>>(new Set());

	const search = useMemo(() => {
		const mini = new MiniSearch<Plugin>({
			fields: ["name", "summary", "id"],
			storeFields: ["id"],
			searchOptions: { boost: { name: 3 }, prefix: true, fuzzy: 0.2 },
		});
		mini.addAll(plugins);
		return mini;
	}, [plugins]);

	const visible = useMemo(() => {
		let filtered = plugins;
		if (active.size > 0) {
			filtered = filtered.filter((p) => active.has(p.category));
		}
		if (query.trim()) {
			const hits = new Set(search.search(query).map((r) => String(r.id)));
			filtered = filtered.filter((p) => hits.has(p.id));
		}
		return filtered;
	}, [plugins, active, query, search]);

	function toggleCategory(id: string) {
		setActive((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	const bg: Record<string, string> = {
		shape: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
		tool: "linear-gradient(135deg, #06b6d4, #0891b2)",
		bg: "linear-gradient(135deg, #10b981, #047857)",
		ai: "linear-gradient(135deg, #ec4899, #8b5cf6)",
		presence: "linear-gradient(135deg, #f59e0b, #ef4444)",
		server: "linear-gradient(135deg, #6366f1, #4338ca)",
		effect: "linear-gradient(135deg, #eab308, #ec4899)",
		ui: "linear-gradient(135deg, #64748b, #334155)",
	};

	return (
		<div className="catalog">
			<div className="catalog__search">
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
				<input
					type="search"
					placeholder="Search plugins…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					aria-label="Search plugins"
				/>
			</div>

			<div className="catalog__chips" role="toolbar" aria-label="Category filters">
				{categories.map((cat) => (
					<button
						type="button"
						key={cat.id}
						className={`chip${active.has(cat.id) ? " chip--active" : ""}`}
						onClick={() => toggleCategory(cat.id)}
						aria-pressed={active.has(cat.id)}
					>
						<span data-lang="en">{cat.label}</span>
						<span data-lang="jp">{cat.jpLabel ?? cat.label}</span>
					</button>
				))}
				{active.size > 0 && (
					<button type="button" className="chip chip--clear" onClick={() => setActive(new Set())}>
						<span data-lang="en">Clear</span>
						<span data-lang="jp">解除</span>
					</button>
				)}
			</div>

			<p className="catalog__count">
				<span data-lang="en">
					{visible.length} {visible.length === 1 ? "plugin" : "plugins"}
				</span>
				<span data-lang="jp">プラグイン {visible.length} 件</span>
			</p>

			<div className="catalog__grid">
				{visible.map((p) => (
					<a key={p.id} className="plugin-card" href={`${basePath}plugins/${p.id}/`}>
						<div className="plugin-card__head">
							<span
								className="plugin-card__glyph"
								style={{ background: bg[p.category] ?? bg.ui }}
								aria-hidden="true"
							>
								{(p.glyph ?? "••").toUpperCase().slice(0, 4)}
							</span>
							<span className="plugin-card__cat">{p.category}</span>
						</div>
						<h3 className="plugin-card__title">
							<span data-lang="en">{p.name}</span>
							<span data-lang="jp">{p.jpName ?? p.name}</span>
						</h3>
						<p className="plugin-card__desc">
							<span data-lang="en">{p.summary}</span>
							<span data-lang="jp">{p.jpSummary ?? p.summary}</span>
						</p>
						<span className="plugin-card__arrow" aria-hidden="true">
							→
						</span>
					</a>
				))}
			</div>

			{visible.length === 0 && (
				<p className="catalog__empty">
					<span data-lang="en">No plugins match your filters.</span>
					<span data-lang="jp">条件に合うプラグインが見つかりません。</span>
				</p>
			)}

			<style>{`
				.catalog { display: grid; gap: var(--space-5); }
				.catalog__search {
					display: flex; align-items: center; gap: var(--space-2);
					height: 48px; padding: 0 var(--space-4);
					background: var(--bg-surface);
					backdrop-filter: blur(20px) saturate(1.4);
					-webkit-backdrop-filter: blur(20px) saturate(1.4);
					border: 1px solid var(--border-subtle);
					border-radius: var(--r-lg);
					color: var(--fg-secondary);
				}
				.catalog__search input {
					flex: 1; background: transparent; border: none; outline: none;
					color: var(--fg-primary); font: inherit; font-size: 15px;
				}
				.catalog__chips { display: flex; flex-wrap: wrap; gap: 8px; }
				.chip {
					height: 30px; padding: 0 12px;
					background: var(--bg-input);
					border: 1px solid var(--border-subtle);
					border-radius: var(--r-pill);
					color: var(--fg-secondary);
					font-size: 12.5px; font-weight: 500;
					cursor: pointer;
					transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
				}
				.chip:hover { color: var(--fg-primary); }
				.chip--active {
					background: var(--brand-gradient);
					color: white;
					border-color: transparent;
				}
				.chip--clear {
					color: var(--fg-tertiary);
					background: transparent;
					border-style: dashed;
				}
				.catalog__count {
					margin: 0;
					color: var(--fg-tertiary);
					font-size: 12px;
				}
				.catalog__grid {
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
					gap: var(--space-4);
				}
				.plugin-card {
					position: relative;
					display: grid;
					gap: var(--space-2);
					padding: var(--space-5);
					background: var(--bg-surface);
					backdrop-filter: blur(20px) saturate(1.4);
					-webkit-backdrop-filter: blur(20px) saturate(1.4);
					border: 1px solid var(--border-subtle);
					border-radius: var(--r-lg);
					color: var(--fg-primary);
					text-decoration: none;
					transition: transform var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out), border-color var(--dur-med) var(--ease-out);
				}
				.plugin-card:hover {
					transform: translateY(-2px);
					box-shadow: var(--shadow-3);
					border-color: var(--border-strong);
				}
				.plugin-card__head {
					display: flex;
					justify-content: space-between;
					align-items: flex-start;
					gap: var(--space-3);
				}
				.plugin-card__glyph {
					width: 48px; height: 48px;
					border-radius: var(--r-md);
					display: inline-flex; align-items: center; justify-content: center;
					color: white; font-family: var(--font-mono); font-weight: 600;
					font-size: 12px; letter-spacing: 0.03em;
					text-transform: uppercase;
					box-shadow: 0 6px 18px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18);
				}
				.plugin-card__cat {
					font-family: var(--font-mono);
					font-size: 10.5px;
					text-transform: uppercase;
					letter-spacing: 0.08em;
					color: var(--fg-tertiary);
					padding: 4px 8px;
					border: 1px solid var(--border-subtle);
					border-radius: var(--r-xs);
				}
				.plugin-card__title {
					font-size: 16px; font-weight: 600; margin: var(--space-2) 0 0;
				}
				.plugin-card__desc {
					font-size: 13px; line-height: 1.5;
					color: var(--fg-secondary);
					margin: 0;
					display: -webkit-box;
					-webkit-line-clamp: 2;
					-webkit-box-orient: vertical;
					overflow: hidden;
				}
				.plugin-card__arrow {
					position: absolute;
					bottom: var(--space-5);
					right: var(--space-5);
					color: var(--fg-tertiary);
					font-size: 16px;
					transition: transform var(--dur-med) var(--ease-out), color var(--dur-med) var(--ease-out);
				}
				.plugin-card:hover .plugin-card__arrow {
					color: var(--brand-violet);
					transform: translateX(4px);
				}
				.catalog__empty {
					padding: var(--space-12) 0;
					text-align: center;
					color: var(--fg-tertiary);
				}
			`}</style>
		</div>
	);
}
