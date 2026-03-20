/**
 * WebSocketメッセージプロトコル
 * クライアント（ws-provider）とサーバー（board-room DO）で共有
 *
 * - SYNC_STEP1/2: 初期同期（Yjs state vector exchange）
 * - YJS_UPDATE: Yjs差分更新（蓄積＋ブロードキャスト）
 * - AWARENESS: Yjs Awareness状態の共有（最新値を保持、切断時に自動消滅）
 * - BROADCAST: イベントの中継（fire-and-forget、蓄積なし）
 */
export const MSG_SYNC_STEP1 = 0;
export const MSG_SYNC_STEP2 = 1;
export const MSG_YJS_UPDATE = 2;
export const MSG_AWARENESS = 3;
export const MSG_BROADCAST = 4;
