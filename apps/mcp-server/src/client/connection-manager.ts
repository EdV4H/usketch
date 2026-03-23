/**
 * ボード接続プール
 * 遅延接続 + 非活動タイムアウトで接続を管理
 */
import type { McpConfig } from "../config.js";
import { BoardConnection } from "./board-connection.js";

/** 非活動時の接続タイムアウト (5分) */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface PoolEntry {
	connection: BoardConnection;
	idleTimer: ReturnType<typeof setTimeout> | null;
}

export class ConnectionManager {
	private readonly pool = new Map<string, PoolEntry>();

	constructor(private readonly config: McpConfig) {}

	/** ボードへの接続を取得（なければ作成して接続） */
	async getConnection(boardId: string): Promise<BoardConnection> {
		const existing = this.pool.get(boardId);
		if (existing) {
			this.resetIdleTimer(boardId, existing);
			if (!existing.connection.isConnected) {
				await existing.connection.connect();
			}
			return existing.connection;
		}

		const connection = new BoardConnection(boardId, this.config);
		const entry: PoolEntry = { connection, idleTimer: null };
		this.pool.set(boardId, entry);
		this.resetIdleTimer(boardId, entry);

		await connection.connect();
		return connection;
	}

	private resetIdleTimer(boardId: string, entry: PoolEntry): void {
		if (entry.idleTimer) clearTimeout(entry.idleTimer);
		entry.idleTimer = setTimeout(() => {
			this.disconnect(boardId);
		}, IDLE_TIMEOUT_MS);
	}

	/** 特定ボードの接続を閉じる */
	disconnect(boardId: string): void {
		const entry = this.pool.get(boardId);
		if (!entry) return;
		if (entry.idleTimer) clearTimeout(entry.idleTimer);
		entry.connection.destroy();
		this.pool.delete(boardId);
	}

	/** 全接続を閉じる */
	destroyAll(): void {
		for (const [boardId] of this.pool) {
			this.disconnect(boardId);
		}
	}
}
