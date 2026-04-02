import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilterPreset, ShapeFilterConfig } from "./types.js";

// ── Presets ──

function makeTimePreset(label: string, description: string, offsetMs: number): FilterPreset {
	return {
		label,
		description,
		config: {
			rules: [
				{
					kind: "time-range",
					field: "_createdAt",
					from: Date.now() - offsetMs,
				},
			],
			combinator: "and",
		},
	};
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

function getPresets(): FilterPreset[] {
	return [
		makeTimePreset("Last hour", "Created within the last hour", HOUR),
		makeTimePreset("Today", "Created today", DAY),
		makeTimePreset("This week", "Created this week", WEEK),
		makeTimePreset("This month", "Created this month", MONTH),
		{
			label: "All",
			description: "Show all shapes (clear filter)",
			config: { rules: [], combinator: "and" },
		},
	];
}

// ── Query parser ──

function parseQuery(query: string): ShapeFilterConfig | null {
	const trimmed = query.trim();
	if (!trimmed) return null;

	// type:xxx
	const typeMatch = trimmed.match(/^type:(\S+)$/);
	if (typeMatch) {
		return {
			rules: [{ kind: "attribute", field: "type", operator: "eq", value: typeMatch[1] }],
			combinator: "and",
		};
	}

	// has:xxx
	const hasMatch = trimmed.match(/^has:(\S+)$/);
	if (hasMatch) {
		return {
			rules: [{ kind: "attribute", field: hasMatch[1], operator: "has" }],
			combinator: "and",
		};
	}

	// not:xxx
	const notMatch = trimmed.match(/^not:(\S+)$/);
	if (notMatch) {
		return {
			rules: [{ kind: "attribute", field: notMatch[1], operator: "not-has" }],
			combinator: "and",
		};
	}

	// Date range: "YYYY-MM-DD" or "YYYY-MM-DD ~ YYYY-MM-DD" or "YYYY-MM-DD から"
	const dateRangeMatch = trimmed.match(
		/^(\d{4}-\d{2}-\d{2})\s*(?:~|から|to)?\s*(\d{4}-\d{2}-\d{2})?$/,
	);
	if (dateRangeMatch) {
		const from = new Date(dateRangeMatch[1]).getTime();
		const to = dateRangeMatch[2] ? new Date(dateRangeMatch[2]).getTime() + DAY - 1 : undefined;
		if (!Number.isNaN(from)) {
			return {
				rules: [
					{
						kind: "time-range",
						field: "_createdAt",
						from,
						...(to != null && !Number.isNaN(to) ? { to } : {}),
					},
				],
				combinator: "and",
			};
		}
	}

	return null;
}

// ── Component ──

export function FilterPalette({
	onApply,
	onClose,
}: {
	onApply: (config: ShapeFilterConfig) => void;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const presets = useMemo(() => getPresets(), []);

	const parsedCustom = useMemo(() => parseQuery(query), [query]);

	const items = useMemo(() => {
		const result: { label: string; description: string; config: ShapeFilterConfig }[] = [];

		if (parsedCustom) {
			result.push({
				label: `Filter: ${query}`,
				description: "Apply custom filter",
				config: parsedCustom,
			});
		}

		const lower = query.toLowerCase();
		for (const preset of presets) {
			if (!lower || preset.label.toLowerCase().includes(lower)) {
				result.push(preset);
			}
		}

		return result;
	}, [presets, parsedCustom, query]);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset index on query change
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	const handleSelect = useCallback(
		(item: (typeof items)[number]) => {
			onApply(item.config);
			onClose();
		},
		[onApply, onClose],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				onClose();
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				const target = items[selectedIndex];
				if (target) handleSelect(target);
				return;
			}
		},
		[items, selectedIndex, handleSelect, onClose],
	);

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 9998,
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				paddingTop: 80,
				background: "rgba(0,0,0,0.15)",
			}}
			onPointerDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				style={{
					width: 440,
					background: "#fff",
					borderRadius: 12,
					border: "1px solid #e5e7eb",
					boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
					overflow: "hidden",
					fontFamily: "system-ui, sans-serif",
				}}
			>
				<input
					ref={inputRef}
					type="text"
					value={query}
					placeholder="Filter shapes... (type:sticky, has:label, 2026-03-01 ~)"
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={handleKeyDown}
					style={{
						width: "100%",
						padding: "12px 16px",
						border: "none",
						borderBottom: "1px solid #e5e7eb",
						outline: "none",
						fontSize: 15,
						boxSizing: "border-box",
					}}
				/>
				{items.length > 0 && (
					<ul
						style={{
							listStyle: "none",
							margin: 0,
							padding: "4px 0",
							maxHeight: 300,
							overflowY: "auto",
						}}
					>
						{items.map((item, i) => (
							<li
								key={item.label}
								onPointerDown={() => handleSelect(item)}
								style={{
									padding: "8px 16px",
									cursor: "pointer",
									fontSize: 14,
									background: i === selectedIndex ? "#f0f4ff" : "transparent",
								}}
							>
								<div style={{ fontWeight: 500 }}>{item.label}</div>
								<div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
									{item.description}
								</div>
							</li>
						))}
					</ul>
				)}
				<div
					style={{
						padding: "8px 16px",
						fontSize: 12,
						color: "#9ca3af",
						borderTop: "1px solid #f3f4f6",
						display: "flex",
						gap: 12,
					}}
				>
					<span>
						<kbd style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>type:</kbd>{" "}
						by type
					</span>
					<span>
						<kbd style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>has:</kbd>{" "}
						by attribute
					</span>
					<span>
						<kbd style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>
							YYYY-MM-DD
						</kbd>{" "}
						by date
					</span>
				</div>
			</div>
		</div>
	);
}
