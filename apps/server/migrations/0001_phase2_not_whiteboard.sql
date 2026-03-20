-- NW-0: Phase 2 "Not Whiteboard" スキーマ拡張
-- board_members に拡張プレゼンス用カラム追加
ALTER TABLE board_members ADD COLUMN last_viewport TEXT;
ALTER TABLE board_members ADD COLUMN last_seen_at TEXT;
ALTER TABLE board_members ADD COLUMN status TEXT DEFAULT 'offline';

-- アクティビティログ（NW-4c: アクティビティフィード用）
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_activity_log_board ON activity_log(board_id, created_at);

-- 通知（NW-3b: レビュー+通知用）
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at);
