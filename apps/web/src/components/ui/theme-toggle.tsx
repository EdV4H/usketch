import type { Theme } from "../../lib/theme.js";
import { useTheme } from "../../lib/use-theme.js";
import { I } from "./icons.js";

const OPTIONS: { value: Theme; label: string; Icon: typeof I.sun }[] = [
	{ value: "light", label: "ライト", Icon: I.sun },
	{ value: "dark", label: "ダーク", Icon: I.moon },
	{ value: "system", label: "システム", Icon: I.monitor },
];

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	return (
		<div
			style={{
				display: "inline-flex",
				gap: 2,
				padding: 2,
				background: "var(--bg-input)",
				border: "1px solid var(--border-subtle)",
				borderRadius: "var(--r-sm)",
			}}
		>
			{OPTIONS.map(({ value, label, Icon }) => {
				const active = theme === value;
				return (
					<button
						key={value}
						type="button"
						aria-pressed={active}
						aria-label={label}
						title={label}
						onClick={() => setTheme(value)}
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 26,
							height: 22,
							background: active ? "var(--bg-surface-raised)" : "transparent",
							color: active ? "var(--brand-violet)" : "var(--fg-tertiary)",
							border: "none",
							borderRadius: 4,
							cursor: "pointer",
							padding: 0,
							transition: "all var(--dur-fast) var(--ease-out)",
						}}
					>
						<Icon size={13} />
					</button>
				);
			})}
		</div>
	);
}
