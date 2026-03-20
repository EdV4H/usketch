/**
 * WebSocketメッセージプロトコル
 * クライアント（ws-provider）とサーバー（board-room DO）で共有
 *
 * - SYNC_STEP1/2: 初期同期（Yjs state vector exchange）
 * - YJS_UPDATE: Yjs差分更新（蓄積＋ブロードキャスト）
 * - BROADCAST: 一時的なデータの中継（蓄積なし、ブロードキャストのみ）
 *   → Awareness（カーソル位置等）やTransient（エフェクト等）はペイロード内で区別
 */
export const MSG_SYNC_STEP1 = 0;
export const MSG_SYNC_STEP2 = 1;
export const MSG_YJS_UPDATE = 2;
export const MSG_BROADCAST = 3;
