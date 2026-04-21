import type { WsConnectionStatus } from "@edv4h/usketch-sync";
import { useEffect, useState } from "react";

type WsProvider = {
	awareness: {
		getStates: () => Map<number, Record<string, unknown>>;
		doc: { clientID: number };
		on?: (event: "change", cb: () => void) => void;
		off?: (event: "change", cb: () => void) => void;
	};
};

interface Member {
	clientId: number;
	name: string;
	color: string;
	status?: string;
}

const USER_COLORS = [
	"var(--u-1)",
	"var(--u-2)",
	"var(--u-3)",
	"var(--u-4)",
	"var(--u-5)",
	"var(--u-6)",
];

function pickColor(clientId: number): string {
	return USER_COLORS[clientId % USER_COLORS.length] ?? "var(--u-1)";
}

function initial(name: string): string {
	return name?.[0]?.toUpperCase() ?? "?";
}

interface Props {
	wsProvider: WsProvider | null;
	connectionStatus?: WsConnectionStatus;
}

/** 右上の presence + 同期状態 pill（モック StatusBar の再現）。 */
export function PresencePill({ wsProvider, connectionStatus }: Props) {
	const [members, setMembers] = useState<Member[]>([]);

	useEffect(() => {
		if (!wsProvider) return;
		const awareness = wsProvider.awareness;
		const read = () => {
			const states = awareness.getStates();
			const list: Member[] = [];
			for (const [clientId, state] of states) {
				if (clientId === awareness.doc.clientID) continue;
				const user = state.user as { name?: string; status?: string } | undefined;
				list.push({
					clientId,
					name: user?.name ?? "Guest",
					color: pickColor(clientId),
					status: user?.status,
				});
			}
			setMembers(list);
		};
		read();
		awareness.on?.("change", read);
		return () => {
			awareness.off?.("change", read);
		};
	}, [wsProvider]);

	const connected = connectionStatus === "connected";
	const visible = members.slice(0, 3);
	const overflow = members.length - visible.length;

	return (
		<div
			className="u-surface"
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 10,
				padding: "6px 10px",
				borderRadius: 999,
				fontSize: 11.5,
				fontFamily: "var(--font-sans, system-ui)",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 5 }}>
				<div
					style={{
						width: 7,
						height: 7,
						borderRadius: 99,
						background: connected ? "var(--success)" : "var(--warning)",
						boxShadow: connected ? "0 0 6px var(--success)" : "none",
					}}
				/>
				<span style={{ color: "var(--fg-secondary)" }}>
					{connected ? "同期中" : connectionStatus === "connecting" ? "接続中…" : "再接続中…"}
				</span>
			</div>
			{members.length > 0 && (
				<>
					<div style={{ width: 1, height: 10, background: "var(--border-default)" }} />
					<div style={{ display: "flex" }}>
						{visible.map((m, i) => (
							<div
								key={m.clientId}
								title={m.name}
								style={{
									width: 20,
									height: 20,
									borderRadius: 99,
									background: m.color,
									color: "white",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 9.5,
									fontWeight: 600,
									border: "2px solid var(--bg-surface-solid)",
									marginLeft: i ? -6 : 0,
									position: "relative",
								}}
							>
								{initial(m.name)}
								{m.status === "busy" && (
									<div
										style={{
											position: "absolute",
											right: -1,
											bottom: -1,
											width: 7,
											height: 7,
											borderRadius: 99,
											background: "var(--danger)",
											border: "1.5px solid var(--bg-surface-solid)",
										}}
									/>
								)}
							</div>
						))}
					</div>
					{overflow > 0 && <span style={{ color: "var(--fg-tertiary)" }}>+ {overflow}</span>}
				</>
			)}
		</div>
	);
}
