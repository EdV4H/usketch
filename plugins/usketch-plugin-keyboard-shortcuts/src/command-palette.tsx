import type { BoardStore, LayerManager } from "@edv4h/usketch-shared";
import { centerOnWorld } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

interface OnlineUser {
	clientId: number;
	name: string;
	viewportCenter: { x: number; y: number } | null;
}

function getOnlineUsers(wsProvider: WsProviderHandle): OnlineUser[] {
	const states = wsProvider.awareness.getStates();
	const localId = wsProvider.awareness.doc.clientID;
	const users: OnlineUser[] = [];

	for (const [clientId, state] of states) {
		if (clientId === localId) continue;
		const avatar = state.avatar as { name?: string; userId?: string } | undefined;
		const vc = state.viewportCenter as { x: number; y: number } | undefined;
		if (!avatar?.name) continue;
		users.push({
			clientId,
			name: avatar.name,
			viewportCenter: vc ?? null,
		});
	}

	return users;
}

function jumpToUser(store: BoardStore, vc: { x: number; y: number }): void {
	centerOnWorld(store, vc);
}

function CommandPaletteUI({
	wsProvider,
	store,
	onClose,
}: {
	wsProvider: WsProviderHandle;
	store: BoardStore;
	onClose: () => void;
}) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const users = useMemo(() => getOnlineUsers(wsProvider), [wsProvider]);

	const isAtQuery = query.startsWith("@");
	const searchTerm = isAtQuery ? query.slice(1).toLowerCase() : "";

	const candidates = useMemo(() => {
		if (!isAtQuery) return [];
		return users.filter((u) => u.name.toLowerCase().includes(searchTerm));
	}, [users, isAtQuery, searchTerm]);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset index on query change
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	const handleSelect = useCallback(
		(user: OnlineUser) => {
			if (user.viewportCenter) {
				jumpToUser(store, user.viewportCenter);
			}
			onClose();
		},
		[store, onClose],
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
				setSelectedIndex((i) => Math.min(i + 1, candidates.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((i) => Math.max(i - 1, 0));
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				const target = candidates[selectedIndex];
				if (target) handleSelect(target);
				return;
			}
		},
		[candidates, selectedIndex, handleSelect, onClose],
	);

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 9999,
				display: "flex",
				alignItems: "flex-end",
				justifyContent: "center",
				paddingBottom: 80,
			}}
			onPointerDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				style={{
					width: 400,
					background: "#fff",
					borderRadius: 12,
					border: "1px solid #e5e7eb",
					overflow: "hidden",
					fontFamily: "system-ui, sans-serif",
				}}
			>
				<input
					ref={inputRef}
					type="text"
					value={query}
					placeholder="@ to jump to a user..."
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
				{isAtQuery && candidates.length > 0 && (
					<ul
						style={{
							listStyle: "none",
							margin: 0,
							padding: "4px 0",
							maxHeight: 240,
							overflowY: "auto",
						}}
					>
						{candidates.map((user, i) => (
							<li
								key={user.clientId}
								onPointerDown={() => handleSelect(user)}
								style={{
									padding: "8px 16px",
									cursor: "pointer",
									fontSize: 14,
									background: i === selectedIndex ? "#f0f4ff" : "transparent",
									display: "flex",
									alignItems: "center",
									gap: 8,
								}}
							>
								<span
									style={{
										width: 8,
										height: 8,
										borderRadius: "50%",
										background: user.viewportCenter ? "#22c55e" : "#9ca3af",
										flexShrink: 0,
									}}
								/>
								<span>{user.name}</span>
								{!user.viewportCenter && (
									<span style={{ fontSize: 11, color: "#9ca3af" }}>(location unavailable)</span>
								)}
							</li>
						))}
					</ul>
				)}
				{isAtQuery && candidates.length === 0 && searchTerm.length > 0 && (
					<div
						style={{
							padding: "12px 16px",
							fontSize: 13,
							color: "#9ca3af",
						}}
					>
						No users found
					</div>
				)}
				{!isAtQuery && (
					<div
						style={{
							padding: "12px 16px",
							fontSize: 13,
							color: "#6b7280",
						}}
					>
						<kbd
							style={{
								background: "#f3f4f6",
								padding: "2px 6px",
								borderRadius: 4,
								fontSize: 12,
							}}
						>
							@name
						</kbd>{" "}
						Jump to user
					</div>
				)}
			</div>
		</div>
	);
}

export interface CommandPaletteController {
	isOpen: () => boolean;
	open: () => void;
	close: () => void;
	dispose: () => void;
}

export function createCommandPalette(
	layers: LayerManager,
	store: BoardStore,
	wsProvider: WsProviderHandle,
): CommandPaletteController {
	let paletteOpen = false;
	const listeners = new Set<() => void>();

	function subscribe(cb: () => void): () => void {
		listeners.add(cb);
		return () => listeners.delete(cb);
	}

	function getSnapshot(): boolean {
		return paletteOpen;
	}

	function setPaletteOpen(value: boolean) {
		paletteOpen = value;
		for (const cb of listeners) cb();
	}

	function CommandPaletteGate() {
		const open = useSyncExternalStore(subscribe, getSnapshot);
		if (!open) return null;
		return <CommandPaletteUI wsProvider={wsProvider} store={store} onClose={close} />;
	}

	function close() {
		setPaletteOpen(false);
	}

	layers.register({
		id: "command-palette",
		order: 999,
		fixed: true,
		render: () => <CommandPaletteGate />,
	});

	return {
		isOpen: () => paletteOpen,
		open: () => setPaletteOpen(true),
		close,
		dispose: () => {
			setPaletteOpen(false);
			listeners.clear();
			layers.unregister("command-palette");
		},
	};
}
