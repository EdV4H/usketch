import { type ReactNode, useEffect, useRef, useState } from "react";
import type { IconComponent } from "./icons.js";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface IconBtnProps {
	icon?: IconComponent;
	label?: string;
	shortcut?: string;
	active?: boolean;
	danger?: boolean;
	size?: number;
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	tooltipPlacement?: TooltipPlacement;
	disabled?: boolean;
	"aria-label"?: string;
	children?: ReactNode;
	title?: string;
}

const TOOLTIP_POS: Record<TooltipPlacement, React.CSSProperties> = {
	top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
	bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
	left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
	right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
};

export function IconBtn({
	icon: IconCmp,
	label,
	shortcut,
	active,
	danger,
	size = 32,
	onClick,
	tooltipPlacement,
	disabled,
	"aria-label": ariaLabel,
	children,
	title,
}: IconBtnProps) {
	const [hover, setHover] = useState(false);
	const [placement, setPlacement] = useState<TooltipPlacement>(tooltipPlacement ?? "bottom");
	const btnRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!hover || tooltipPlacement) return;
		const el = btnRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;
		const spaceRight = window.innerWidth - rect.right;
		const spaceLeft = rect.left;
		if (spaceBelow < 60 && spaceAbove > spaceBelow) setPlacement("top");
		else if (spaceRight < 80 && spaceLeft > spaceRight) setPlacement("left");
		else if (spaceLeft < 80 && spaceRight > spaceLeft) setPlacement("right");
		else setPlacement("bottom");
	}, [hover, tooltipPlacement]);

	const idleColor = danger ? "var(--danger)" : "var(--fg-secondary)";

	return (
		<button
			ref={btnRef}
			type="button"
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			disabled={disabled}
			aria-label={ariaLabel ?? label}
			title={title}
			style={{
				position: "relative",
				width: size,
				height: size,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				background: active
					? "var(--bg-active)"
					: hover && !disabled
						? "var(--bg-hover)"
						: "transparent",
				color: active
					? "var(--brand-violet)"
					: hover && !disabled
						? "var(--fg-primary)"
						: idleColor,
				border: "none",
				borderRadius: "var(--r-sm)",
				cursor: disabled ? "default" : "pointer",
				opacity: disabled ? 0.45 : 1,
				transition:
					"background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
				flexShrink: 0,
				padding: 0,
			}}
		>
			{IconCmp ? <IconCmp /> : null}
			{children}
			{hover && label && !disabled && (
				<div
					style={{
						position: "absolute",
						...TOOLTIP_POS[placement],
						background: "var(--bg-surface-solid)",
						color: "var(--fg-primary)",
						padding: "5px 9px",
						borderRadius: 6,
						fontSize: 11.5,
						whiteSpace: "nowrap",
						border: "1px solid var(--border-default)",
						boxShadow: "var(--shadow-2)",
						zIndex: 1000,
						pointerEvents: "none",
						display: "flex",
						alignItems: "center",
						gap: 6,
						fontWeight: 500,
					}}
				>
					{label}
					{shortcut && (
						<span className="u-kbd" style={{ marginLeft: 2 }}>
							{shortcut}
						</span>
					)}
				</div>
			)}
		</button>
	);
}
