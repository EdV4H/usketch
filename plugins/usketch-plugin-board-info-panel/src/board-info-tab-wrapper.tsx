import type { BoardStore } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import type { BoardInfoClient } from "./board-info-client.js";
import { BoardInfoTab } from "./board-info-tab.js";

interface EventBus {
	on<T>(event: string, handler: (data: T) => void): () => void;
}

interface BoardInfoTabWrapperProps {
	client: BoardInfoClient;
	events: EventBus;
	store: BoardStore;
	onOpenBoard: (boardId: string) => void;
	getBoardId: () => string | null;
}

export function BoardInfoTabWrapper({
	client,
	events,
	store,
	onOpenBoard,
	getBoardId,
}: BoardInfoTabWrapperProps) {
	// イベント経由で再レンダーをトリガーしつつ、getBoardId() で最新値を取得
	const boardId = useSyncExternalStore(
		(callback) => events.on("board-info:select", callback),
		getBoardId,
	);

	return <BoardInfoTab boardId={boardId} client={client} store={store} onOpenBoard={onOpenBoard} />;
}
