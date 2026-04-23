import { useEffect, useState } from "react";

type Theme = "dark" | "light";
type Density = "comfortable" | "compact";
type Accent = "violet-pink" | "cyan-violet" | "mono";
type JpMode = "en" | "jp" | "both";

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
	try {
		const v = localStorage.getItem(key) as T | null;
		return v && allowed.includes(v) ? v : fallback;
	} catch {
		return fallback;
	}
}

export default function TweaksPanel() {
	const [open, setOpen] = useState(false);
	const [theme, setTheme] = useState<Theme>("dark");
	const [density, setDensity] = useState<Density>("comfortable");
	const [accent, setAccent] = useState<Accent>("violet-pink");
	const [jp, setJp] = useState<JpMode>("en");

	useEffect(() => {
		const html = document.documentElement;
		setTheme(
			read("usketch-theme", ["dark", "light"] as const, (html.dataset.theme as Theme) || "dark"),
		);
		setDensity(read("usketch-density", ["comfortable", "compact"] as const, "comfortable"));
		setAccent(
			read("usketch-accent", ["violet-pink", "cyan-violet", "mono"] as const, "violet-pink"),
		);
		setJp(read("usketch-jp-mode", ["en", "jp", "both"] as const, "en"));

		function handler() {
			setOpen((o) => !o);
		}
		window.addEventListener("usketch:open-tweaks", handler);
		return () => window.removeEventListener("usketch:open-tweaks", handler);
	}, []);

	function apply(key: string, value: string, dataKey: string) {
		document.documentElement.dataset[dataKey] = value;
		try {
			localStorage.setItem(key, value);
		} catch {}
	}

	return (
		<>
			<button
				type="button"
				className="tweaks-toggle"
				onClick={() => setOpen((o) => !o)}
				aria-label="Toggle tweaks panel"
			>
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
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</button>

			{open && (
				<aside className="tweaks">
					<header>
						<h3>Tweaks</h3>
						<button type="button" onClick={() => setOpen(false)} aria-label="Close">
							✕
						</button>
					</header>

					<fieldset className="tweaks__row">
						<legend className="tweaks__label">Theme</legend>
						<div className="tweaks__segment">
							{(["dark", "light"] as const).map((v) => (
								<button
									type="button"
									aria-pressed={theme === v}
									key={v}
									className={theme === v ? "is-active" : ""}
									onClick={() => {
										setTheme(v);
										apply("usketch-theme", v, "theme");
									}}
								>
									{v}
								</button>
							))}
						</div>
					</fieldset>

					<fieldset className="tweaks__row">
						<legend className="tweaks__label">Density</legend>
						<div className="tweaks__segment">
							{(["comfortable", "compact"] as const).map((v) => (
								<button
									type="button"
									aria-pressed={density === v}
									key={v}
									className={density === v ? "is-active" : ""}
									onClick={() => {
										setDensity(v);
										apply("usketch-density", v, "density");
									}}
								>
									{v}
								</button>
							))}
						</div>
					</fieldset>

					<fieldset className="tweaks__row">
						<legend className="tweaks__label">Accent</legend>
						<div className="tweaks__segment">
							{(["violet-pink", "cyan-violet", "mono"] as const).map((v) => (
								<button
									type="button"
									aria-pressed={accent === v}
									key={v}
									className={accent === v ? "is-active" : ""}
									onClick={() => {
										setAccent(v);
										apply("usketch-accent", v, "accent");
									}}
								>
									{v}
								</button>
							))}
						</div>
					</fieldset>

					<fieldset className="tweaks__row">
						<legend className="tweaks__label">JP Mode</legend>
						<div className="tweaks__segment">
							{(["en", "both", "jp"] as const).map((v) => (
								<button
									type="button"
									aria-pressed={jp === v}
									key={v}
									className={jp === v ? "is-active" : ""}
									onClick={() => {
										setJp(v);
										apply("usketch-jp-mode", v, "jpMode");
									}}
								>
									{v.toUpperCase()}
								</button>
							))}
						</div>
					</fieldset>
				</aside>
			)}

			<style>{`
				.tweaks-toggle {
					position: fixed;
					bottom: 20px;
					right: 20px;
					z-index: 60;
					width: 40px;
					height: 40px;
					border-radius: var(--r-pill);
					background: var(--bg-surface);
					backdrop-filter: blur(20px) saturate(1.4);
					-webkit-backdrop-filter: blur(20px) saturate(1.4);
					border: 1px solid var(--border-default);
					color: var(--fg-secondary);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow: var(--shadow-2);
					transition: color var(--dur-fast) var(--ease-out);
				}
				.tweaks-toggle:hover { color: var(--fg-primary); }
				.tweaks {
					position: fixed;
					bottom: 72px;
					right: 20px;
					z-index: 60;
					width: 320px;
					padding: var(--space-4);
					background: var(--bg-surface);
					backdrop-filter: blur(20px) saturate(1.4);
					-webkit-backdrop-filter: blur(20px) saturate(1.4);
					border: 1px solid var(--border-default);
					border-radius: var(--r-lg);
					box-shadow: var(--shadow-3);
					display: grid;
					gap: var(--space-3);
				}
				.tweaks header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
				.tweaks h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-tertiary); margin: 0; }
				.tweaks header button { color: var(--fg-tertiary); font-size: 14px; cursor: pointer; }
				.tweaks__row {
					display: grid;
					gap: 6px;
					border: 0;
					margin: 0;
					padding: 0;
					min-width: 0;
				}
				.tweaks__row .tweaks__label {
					font-size: 11px;
					color: var(--fg-tertiary);
					text-transform: uppercase;
					letter-spacing: 0.06em;
					padding: 0;
				}
				.tweaks__segment {
					display: flex;
					background: var(--bg-input);
					border-radius: var(--r-sm);
					padding: 2px;
					gap: 2px;
				}
				.tweaks__segment button {
					flex: 1;
					padding: 6px 8px;
					border-radius: 4px;
					font-size: 11.5px;
					font-weight: 500;
					color: var(--fg-secondary);
					cursor: pointer;
					text-transform: capitalize;
				}
				.tweaks__segment button.is-active {
					background: var(--bg-surface-raised);
					color: var(--fg-primary);
					box-shadow: inset 0 0 0 1px var(--border-subtle);
				}
			`}</style>
		</>
	);
}
