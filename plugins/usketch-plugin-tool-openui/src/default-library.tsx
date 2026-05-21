import { createLibrary, defineComponent, useRenderNode } from "@openuidev/react-lang";
import { type CSSProperties, Fragment, type ReactNode } from "react";
import { z } from "zod/v4";

/**
 * Bundled `Library` for the OpenUI tool plugin. A deliberately small set of
 * generic UI primitives that the LLM can compose into widgets without
 * needing host-app context. Hosts that want richer or branded components
 * should pass their own `createLibrary(...)` via `createOpenUIToolPlugin`.
 *
 * Container components (Stack, Card, List, Row) accept a `children` prop that
 * is an array of nested component values. The OpenUI Lang DSL writes them as
 * positional arguments: `Stack([Heading("Hi"), Text("body")])`.
 */

function renderArray(
	values: readonly unknown[] | undefined,
	render: ReturnType<typeof useRenderNode>,
): ReactNode {
	if (!values) return null;
	// Use Fragment, not <div>, so flex-child semantics (e.g. Spacer's flex: 1)
	// apply to the actual rendered component instead of being trapped by a
	// wrapper element.
	return values.map((v, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: OpenUI Lang nodes are positional and stable
		<Fragment key={i}>{render(v)}</Fragment>
	));
}

const Stack = defineComponent({
	name: "Stack",
	description: "Vertical or horizontal flex container that groups children with a consistent gap.",
	props: z.object({
		direction: z.enum(["column", "row"]).default("column"),
		gap: z.number().default(8),
		align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
		padding: z.number().default(0),
		children: z.array(z.unknown()).default([]),
	}),
	component: ({ props }) => {
		const render = useRenderNode();
		return (
			<div
				style={{
					display: "flex",
					flexDirection: props.direction,
					gap: props.gap,
					alignItems: props.align,
					padding: props.padding,
				}}
			>
				{renderArray(props.children, render)}
			</div>
		);
	},
});

const Heading = defineComponent({
	name: "Heading",
	description: "Headline text used for widget titles and section labels.",
	props: z.object({
		text: z.string(),
		level: z.enum(["h1", "h2", "h3", "h4"]).default("h2"),
	}),
	component: ({ props }) => {
		const size = { h1: 28, h2: 22, h3: 18, h4: 16 }[props.level];
		return (
			<div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.2, color: "#0f172a" }}>
				{props.text}
			</div>
		);
	},
});

const Text = defineComponent({
	name: "Text",
	description: "Body text or paragraph content.",
	props: z.object({
		text: z.string(),
		muted: z.boolean().default(false),
	}),
	component: ({ props }) => (
		<div style={{ fontSize: 14, lineHeight: 1.5, color: props.muted ? "#71717a" : "#1f2937" }}>
			{props.text}
		</div>
	),
});

const Card = defineComponent({
	name: "Card",
	description:
		"Padded surface with a subtle border. Use as the outer container of self-contained widgets.",
	props: z.object({
		padding: z.number().default(16),
		children: z.array(z.unknown()).default([]),
	}),
	component: ({ props }) => {
		const render = useRenderNode();
		return (
			<div
				style={{
					background: "#ffffff",
					border: "1px solid #e5e7eb",
					borderRadius: 8,
					padding: props.padding,
					boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
				}}
			>
				{renderArray(props.children, render)}
			</div>
		);
	},
});

const buttonVariants: Record<string, CSSProperties> = {
	primary: { background: "#0f172a", color: "#ffffff", border: "1px solid #0f172a" },
	secondary: { background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1" },
	ghost: { background: "transparent", color: "#0f172a", border: "1px solid transparent" },
};

const Button = defineComponent({
	name: "Button",
	description:
		"Primary or secondary call-to-action button. Static — does not invoke real handlers.",
	props: z.object({
		label: z.string(),
		variant: z.enum(["primary", "secondary", "ghost"]).default("primary"),
	}),
	component: ({ props }) => (
		<button
			type="button"
			style={{
				...buttonVariants[props.variant],
				padding: "8px 14px",
				borderRadius: 6,
				fontSize: 14,
				fontWeight: 500,
				cursor: "pointer",
			}}
		>
			{props.label}
		</button>
	),
});

const Input = defineComponent({
	name: "Input",
	description: "Single-line text input. Static preview — no controlled value.",
	props: z.object({
		placeholder: z.string().default(""),
		label: z.string().default(""),
	}),
	component: ({ props }) => (
		<label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			{props.label && <span style={{ fontSize: 13, color: "#374151" }}>{props.label}</span>}
			<input
				type="text"
				placeholder={props.placeholder}
				style={{
					padding: "8px 10px",
					border: "1px solid #cbd5e1",
					borderRadius: 6,
					fontSize: 14,
					background: "#ffffff",
				}}
			/>
		</label>
	),
});

const badgeTones: Record<string, { bg: string; fg: string }> = {
	neutral: { bg: "#f1f5f9", fg: "#0f172a" },
	success: { bg: "#dcfce7", fg: "#166534" },
	warn: { bg: "#fef3c7", fg: "#92400e" },
	danger: { bg: "#fee2e2", fg: "#991b1b" },
};

const Badge = defineComponent({
	name: "Badge",
	description: "Compact pill used to highlight a tag, count, or status.",
	props: z.object({
		text: z.string(),
		tone: z.enum(["neutral", "success", "warn", "danger"]).default("neutral"),
	}),
	component: ({ props }) => {
		const t = badgeTones[props.tone];
		return (
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					padding: "2px 8px",
					borderRadius: 999,
					background: t.bg,
					color: t.fg,
					fontSize: 12,
					fontWeight: 500,
				}}
			>
				{props.text}
			</span>
		);
	},
});

const Avatar = defineComponent({
	name: "Avatar",
	description: "Circular avatar with initials. Use when a real image is not available.",
	props: z.object({
		initials: z.string(),
		size: z.number().default(32),
		color: z.string().default("#0ea5e9"),
	}),
	component: ({ props }) => (
		<div
			style={{
				width: props.size,
				height: props.size,
				borderRadius: "50%",
				background: props.color,
				color: "#ffffff",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: Math.round(props.size * 0.4),
				fontWeight: 600,
			}}
		>
			{props.initials}
		</div>
	),
});

const Image = defineComponent({
	name: "Image",
	description: "External image element. Use when a real source URL is provided in the prompt.",
	props: z.object({
		src: z.string(),
		alt: z.string().default(""),
		fit: z.enum(["cover", "contain"]).default("cover"),
	}),
	component: ({ props }) => (
		<img
			src={props.src}
			alt={props.alt}
			style={{ width: "100%", height: "100%", objectFit: props.fit, borderRadius: 6 }}
		/>
	),
});

const List = defineComponent({
	name: "List",
	description: "Vertical list. Children are rendered as separate rows.",
	props: z.object({
		divided: z.boolean().default(true),
		children: z.array(z.unknown()).default([]),
	}),
	component: ({ props }) => {
		const render = useRenderNode();
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: props.divided ? 0 : 8,
				}}
			>
				{renderArray(props.children, render)}
			</div>
		);
	},
});

const Row = defineComponent({
	name: "Row",
	description: "Horizontal row primitive used inside List or as a layout helper.",
	props: z.object({
		gap: z.number().default(8),
		align: z.enum(["start", "center", "end"]).default("center"),
		children: z.array(z.unknown()).default([]),
	}),
	component: ({ props }) => {
		const render = useRenderNode();
		return (
			<div
				style={{
					display: "flex",
					gap: props.gap,
					alignItems: props.align,
					padding: "8px 0",
					borderBottom: "1px solid #f1f5f9",
				}}
			>
				{renderArray(props.children, render)}
			</div>
		);
	},
});

const Spacer = defineComponent({
	name: "Spacer",
	description: "Flexible empty space used to push siblings apart in a Row or Stack.",
	props: z.object({ size: z.number().default(8) }),
	component: ({ props }) => (
		<div style={{ flex: 1, minWidth: props.size, minHeight: props.size }} />
	),
});

/** Bundled OpenUI library shipped with `usketch-plugin-tool-openui`. */
export const openuiDefaultLibrary = createLibrary({
	components: [Stack, Heading, Text, Card, Button, Input, Badge, Avatar, Image, List, Row, Spacer],
	root: "Stack",
});

export const OPENUI_DEFAULT_LIBRARY_ID = "openui-default";
