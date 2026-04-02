/**
 * WebSocketメッセージプロトコル
 * クライアント（ws-provider）とサーバー（board-room DO）で共有
 *
 * - SYNC_STEP1/2: 初期同期（クライアントがSTEP1を送信→サーバーが蓄積updateをSTEP2で返送）
 * - YJS_UPDATE: Yjs差分更新（蓄積＋ブロードキャスト）
 * - AWARENESS: Yjs Awareness状態の共有（最新値を保持、切断時に自動消滅）
 * - BROADCAST: イベントの中継（fire-and-forget、蓄積なし）
 * - PARTITION_REQUEST: クライアント→サーバー、追加パーティション要求（JSON payload）
 * - PARTITION_META: サーバー→クライアント、利用可能パーティション一覧（JSON payload）
 */
export const MSG_SYNC_STEP1 = 0;
export const MSG_SYNC_STEP2 = 1;
export const MSG_YJS_UPDATE = 2;
export const MSG_AWARENESS = 3;
export const MSG_BROADCAST = 4;
export const MSG_PARTITION_REQUEST = 5;
export const MSG_PARTITION_META = 6;
