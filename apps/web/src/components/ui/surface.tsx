import type { CSSProperties, ReactNode } from "react";

interface SurfaceProps {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	as?: "div" | "section" | "aside" | "nav";
	role?: string;
	"aria-label"?: string;
}

/**
 * Glassmorphic floating surface — `className="u-surface"` を適用する薄いラッパー。
 * 追加クラスや style は merge。
 */
export function Surface({
	children,
	className,
	style,
	as: Tag = "div",
	role,
	"aria-label": ariaLabel,
}: SurfaceProps) {
	const cls = className ? `u-surface ${className}` : "u-surface";
	return (
		<Tag className={cls} style={style} role={role} aria-label={ariaLabel}>
			{children}
		</Tag>
	);
}
