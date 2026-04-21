/**
 * Thin-line 16px icon set — モック (whiteboard-new-design/components/icons.jsx) から移植。
 * 全アイコン stroke-width 1.5、currentColor。
 */

import type { CSSProperties, ReactNode } from "react";

interface IconProps {
	size?: number;
	className?: string;
	style?: CSSProperties;
}

function Icon({ children, size = 16, className, style }: IconProps & { children: ReactNode }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			style={style}
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

export type IconComponent = (props: IconProps) => ReactNode;

export const I = {
	// Tools
	cursor: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 2.5 8 13l2-4.5L14.5 7 3 2.5Z" />
		</Icon>
	),
	hand: (p: IconProps) => (
		<Icon {...p}>
			<path d="M5 8V4a1 1 0 1 1 2 0v3" />
			<path d="M7 7V3a1 1 0 1 1 2 0v4" />
			<path d="M9 7V4a1 1 0 1 1 2 0v5" />
			<path d="M11 6a1 1 0 1 1 2 0v5c0 2-2 3.5-4 3.5s-4-1-4-3L3.5 8.5a1 1 0 0 1 1.7-1L6 8.5" />
		</Icon>
	),
	rect: (p: IconProps) => (
		<Icon {...p}>
			<rect x="2.5" y="3.5" width="11" height="9" rx="1" />
		</Icon>
	),
	circle: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="5.5" />
		</Icon>
	),
	triangle: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 2.5 14 13H2L8 2.5Z" />
		</Icon>
	),
	diamond: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 2 14 8l-6 6-6-6 6-6Z" />
		</Icon>
	),
	star: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 2.2 9.7 6l4.1.4-3.1 2.8.9 4.1L8 11.2 4.4 13.3l.9-4.1L2.2 6.4 6.3 6 8 2.2Z" />
		</Icon>
	),
	arrow: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2.5 8h11M10 4.5 13.5 8 10 11.5" />
		</Icon>
	),
	line: (p: IconProps) => (
		<Icon {...p}>
			<path d="m3 13 10-10" />
		</Icon>
	),
	text: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 4V3h10v1M8 3v10M6 13h4" />
		</Icon>
	),
	sticky: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2.5 3.5h8l3 3v7h-11v-10Z" />
			<path d="M10.5 3.5v3h3" />
		</Icon>
	),
	pen: (p: IconProps) => (
		<Icon {...p}>
			<path d="M11 2.5 13.5 5 5 13.5H2.5V11L11 2.5Z" />
		</Icon>
	),
	image: (p: IconProps) => (
		<Icon {...p}>
			<rect x="2" y="3" width="12" height="10" rx="1.5" />
			<circle cx="5.5" cy="6.5" r="1" />
			<path d="m2.5 11.5 3-3 3 3 2-2 3 3" />
		</Icon>
	),
	frame: (p: IconProps) => (
		<Icon {...p}>
			<path d="M4 2v12M12 2v12M2 4h12M2 12h12" />
		</Icon>
	),
	connector: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="3" cy="3" r="1.2" />
			<circle cx="13" cy="13" r="1.2" />
			<path d="M4 4c4 0 4 8 8 8" />
		</Icon>
	),
	ui: (p: IconProps) => (
		<Icon {...p}>
			<rect x="2" y="2.5" width="12" height="11" rx="1.5" />
			<path d="M2 6h12M5 9.5h3M5 11.5h5" />
		</Icon>
	),

	// Actions
	undo: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 6h7a3.5 3.5 0 0 1 0 7H6M3 6l2.5-2.5M3 6l2.5 2.5" />
		</Icon>
	),
	redo: (p: IconProps) => (
		<Icon {...p}>
			<path d="M13 6H6a3.5 3.5 0 0 0 0 7h4M13 6l-2.5-2.5M13 6l-2.5 2.5" />
		</Icon>
	),
	grid: (p: IconProps) => (
		<Icon {...p}>
			<rect x="2.5" y="2.5" width="11" height="11" rx=".5" />
			<path d="M6 2.5v11M10 2.5v11M2.5 6h11M2.5 10h11" />
		</Icon>
	),
	dots: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="4" cy="4" r=".6" fill="currentColor" />
			<circle cx="8" cy="4" r=".6" fill="currentColor" />
			<circle cx="12" cy="4" r=".6" fill="currentColor" />
			<circle cx="4" cy="8" r=".6" fill="currentColor" />
			<circle cx="8" cy="8" r=".6" fill="currentColor" />
			<circle cx="12" cy="8" r=".6" fill="currentColor" />
			<circle cx="4" cy="12" r=".6" fill="currentColor" />
			<circle cx="8" cy="12" r=".6" fill="currentColor" />
			<circle cx="12" cy="12" r=".6" fill="currentColor" />
		</Icon>
	),
	bgNone: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="5.5" />
			<path d="m4 12 8-8" />
		</Icon>
	),
	zoomIn: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="7" cy="7" r="4.5" />
			<path d="m10.5 10.5 3 3M5 7h4M7 5v4" />
		</Icon>
	),
	zoomOut: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="7" cy="7" r="4.5" />
			<path d="m10.5 10.5 3 3M5 7h4" />
		</Icon>
	),
	present: (p: IconProps) => (
		<Icon {...p}>
			<rect x="1.5" y="3" width="13" height="9" rx="1" />
			<path d="M6 14h4M8 12v2" />
		</Icon>
	),
	mic: (p: IconProps) => (
		<Icon {...p}>
			<rect x="6" y="2" width="4" height="8" rx="2" />
			<path d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14" />
		</Icon>
	),
	sparkles: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4.5 4.5l2 2M9.5 9.5l2 2M11.5 4.5l-2 2M6.5 9.5l-2 2" />
		</Icon>
	),
	search: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="7" cy="7" r="4.5" />
			<path d="m10.5 10.5 3 3" />
		</Icon>
	),
	close: (p: IconProps) => (
		<Icon {...p}>
			<path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
		</Icon>
	),
	plus: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 3v10M3 8h10" />
		</Icon>
	),
	minus: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 8h10" />
		</Icon>
	),
	more: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="3.5" cy="8" r=".8" fill="currentColor" />
			<circle cx="8" cy="8" r=".8" fill="currentColor" />
			<circle cx="12.5" cy="8" r=".8" fill="currentColor" />
		</Icon>
	),
	chevDown: (p: IconProps) => (
		<Icon {...p}>
			<path d="m4 6 4 4 4-4" />
		</Icon>
	),
	chevRight: (p: IconProps) => (
		<Icon {...p}>
			<path d="m6 4 4 4-4 4" />
		</Icon>
	),
	chevLeft: (p: IconProps) => (
		<Icon {...p}>
			<path d="m10 4-4 4 4 4" />
		</Icon>
	),
	chevUp: (p: IconProps) => (
		<Icon {...p}>
			<path d="m4 10 4-4 4 4" />
		</Icon>
	),
	check: (p: IconProps) => (
		<Icon {...p}>
			<path d="m3 8 3.5 3.5L13 5" />
		</Icon>
	),
	comment: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2.5 7.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5-2.5 5-5.5 5c-.7 0-1.4-.1-2-.3L3 13.5l.8-2.4a4.8 4.8 0 0 1-1.3-3.6Z" />
		</Icon>
	),
	users: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="6" cy="5.5" r="2.2" />
			<path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
			<circle cx="11" cy="5" r="1.8" />
			<path d="M10.5 9a3.5 3.5 0 0 1 3.5 3.5" />
		</Icon>
	),
	share: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="3.5" cy="8" r="1.7" />
			<circle cx="12" cy="3.5" r="1.7" />
			<circle cx="12" cy="12.5" r="1.7" />
			<path d="m5 7 5.5-2.8M5 9l5.5 2.8" />
		</Icon>
	),
	layers: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 1.5 1.5 5 8 8.5 14.5 5 8 1.5ZM1.5 8 8 11.5 14.5 8M1.5 11 8 14.5 14.5 11" />
		</Icon>
	),
	home: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5h-3V10H6v3.5H3a.5.5 0 0 1-.5-.5V7.5Z" />
		</Icon>
	),
	back: (p: IconProps) => (
		<Icon {...p}>
			<path d="M13 8H3M7 4 3 8l4 4" />
		</Icon>
	),
	download: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13h10" />
		</Icon>
	),
	lock: (p: IconProps) => (
		<Icon {...p}>
			<rect x="3.5" y="7" width="9" height="6.5" rx="1" />
			<path d="M5 7V5a3 3 0 0 1 6 0v2" />
		</Icon>
	),
	globe: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="5.5" />
			<path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" />
		</Icon>
	),
	link: (p: IconProps) => (
		<Icon {...p}>
			<path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1" />
			<path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l1-1" />
		</Icon>
	),
	trash: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4M7 6.5v5M9 6.5v5" />
		</Icon>
	),
	moon: (p: IconProps) => (
		<Icon {...p}>
			<path d="M12.5 9A5 5 0 0 1 7 3.5 5.2 5.2 0 0 0 8 13.5a5 5 0 0 0 4.5-4.5Z" />
		</Icon>
	),
	sun: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="3" />
			<path d="M8 1.5v1.5M8 13v1.5M2.5 8H1M15 8h-1.5M3.7 3.7l1 1M11.3 11.3l1 1M3.7 12.3l1-1M11.3 4.7l1-1" />
		</Icon>
	),
	monitor: (p: IconProps) => (
		<Icon {...p}>
			<rect x="1.5" y="2.5" width="13" height="9" rx="1" />
			<path d="M5 14h6M8 11.5V14" />
		</Icon>
	),
	eye: (p: IconProps) => (
		<Icon {...p}>
			<path d="M1.5 8S4 3 8 3s6.5 5 6.5 5S12 13 8 13 1.5 8 1.5 8Z" />
			<circle cx="8" cy="8" r="2" />
		</Icon>
	),
	ghost: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 13V7a5 5 0 0 1 10 0v6l-1.5-1L10 13l-2-1-2 1-1.5-1L3 13Z" />
			<circle cx="6.5" cy="7" r=".6" fill="currentColor" />
			<circle cx="9.5" cy="7" r=".6" fill="currentColor" />
		</Icon>
	),
	wand: (p: IconProps) => (
		<Icon {...p}>
			<path d="m3 13 8-8M10 4l2 2M12.5 1.5v2M15 4h-2M2 8v1M4 8H3" />
		</Icon>
	),
	play: (p: IconProps) => (
		<Icon {...p}>
			<path d="M4 3v10l9-5L4 3Z" />
		</Icon>
	),
	settings: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="1.8" />
			<path d="M12.5 8a4.5 4.5 0 0 0-.1-1l1-.8-1-1.7-1.3.3a4.5 4.5 0 0 0-1.7-1l-.2-1.3H7.8l-.2 1.3a4.5 4.5 0 0 0-1.7 1l-1.3-.3-1 1.7 1 .8a4.5 4.5 0 0 0 0 2l-1 .8 1 1.7 1.3-.3a4.5 4.5 0 0 0 1.7 1l.2 1.3h1.4l.2-1.3a4.5 4.5 0 0 0 1.7-1l1.3.3 1-1.7-1-.8c.1-.3.1-.7.1-1Z" />
		</Icon>
	),
	bell: (p: IconProps) => (
		<Icon {...p}>
			<path d="M4 10.5c0-1 .5-1.5.5-4a3.5 3.5 0 0 1 7 0c0 2.5.5 3 .5 4H4Z" />
			<path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
		</Icon>
	),
	history: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2.5 8a5.5 5.5 0 1 0 1.5-3.8" />
			<path d="M2.5 3v3h3M8 5v3l2 1.5" />
		</Icon>
	),
	palette: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 13.5A5.5 5.5 0 1 1 8 2.5c3 0 5.5 2 5.5 4.5 0 1.5-1.5 2-3 2h-1a1 1 0 0 0-.5 1.8c.4.4.5 1 .3 1.5-.2.5-.7.7-1.3.7Z" />
			<circle cx="5" cy="6" r=".8" fill="currentColor" />
			<circle cx="8" cy="5" r=".8" fill="currentColor" />
			<circle cx="11" cy="6.5" r=".8" fill="currentColor" />
		</Icon>
	),
	group: (p: IconProps) => (
		<Icon {...p}>
			<rect x="1.5" y="1.5" width="5" height="5" rx=".5" />
			<rect x="9.5" y="1.5" width="5" height="5" rx=".5" />
			<rect x="1.5" y="9.5" width="5" height="5" rx=".5" />
			<rect x="9.5" y="9.5" width="5" height="5" rx=".5" />
		</Icon>
	),
	align: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2 2v12M4 4h6M4 8h9M4 12h4" />
		</Icon>
	),
	pin: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 1.5 6 3v4L3 9l3 .5V14l2-1.5v-3L11 9 8 7V3L8 1.5Z" />
		</Icon>
	),
	map: (p: IconProps) => (
		<Icon {...p}>
			<path d="M1.5 3.5 5.5 2l5 2 4-1.5v10l-4 1.5-5-2-4 1.5v-10Z" />
			<path d="M5.5 2v10M10.5 4v10" />
		</Icon>
	),
	community: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="4.5" r="1.7" />
			<circle cx="4" cy="11" r="1.5" />
			<circle cx="12" cy="11" r="1.5" />
			<path d="M6.5 5.5 5 9.5M9.5 5.5l1.5 4M5.5 11h5" />
		</Icon>
	),
	spotlight: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5" />
			<circle cx="8" cy="8" r="3" />
		</Icon>
	),
	laser: (p: IconProps) => (
		<Icon {...p}>
			<path d="M8 1v2" />
			<path d="M8 15v-2" />
			<circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" />
			<path d="M8 5v1.5M8 11v-1.5" />
		</Icon>
	),
	reaction: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="5.5" />
			<path d="M5.5 9.5c.5 1 1.4 1.5 2.5 1.5s2-.5 2.5-1.5" />
			<circle cx="6" cy="6.5" r=".5" fill="currentColor" />
			<circle cx="10" cy="6.5" r=".5" fill="currentColor" />
		</Icon>
	),
	chat: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2.5 4.5c0-1 .8-2 2-2h7c1.2 0 2 1 2 2v5c0 1-.8 2-2 2H6.5L3.5 14v-2.5c-.6-.3-1-1-1-1.5v-5.5Z" />
		</Icon>
	),
	send: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2 8 14 2l-5 12-2-5L2 8Z" />
		</Icon>
	),
	folder: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z" />
		</Icon>
	),
	star2: (p: IconProps) => (
		<Icon {...p}>
			<path
				d="M8 2 9.8 6l4.2.4-3.2 2.8 1 4.1L8 11.2 4.2 13.3l1-4.1L2 6.4 6.2 6 8 2Z"
				fill="currentColor"
				strokeWidth="0"
			/>
		</Icon>
	),
	vote: (p: IconProps) => (
		<Icon {...p}>
			<path d="M3 7.5 5.5 10l7-7M2.5 11.5h11v2h-11z" />
		</Icon>
	),
	clock: (p: IconProps) => (
		<Icon {...p}>
			<circle cx="8" cy="8" r="5.5" />
			<path d="M8 4.5V8l2 1.5" />
		</Icon>
	),
	bolt: (p: IconProps) => (
		<Icon {...p}>
			<path d="M9 2 4 9h4l-1 5 5-7H8l1-5Z" />
		</Icon>
	),
	translate: (p: IconProps) => (
		<Icon {...p}>
			<path d="M2 3h6M5 3v1.5c0 2-1 3.5-3 4.5M3 5.5c0 2 2 3.5 4 3.5M9 14l2.5-6 2.5 6M10 12h3" />
		</Icon>
	),
} satisfies Record<string, IconComponent>;
