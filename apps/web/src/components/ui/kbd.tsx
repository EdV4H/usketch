import type { ReactNode } from "react";

interface KbdProps {
	children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
	return <span className="u-kbd">{children}</span>;
}
