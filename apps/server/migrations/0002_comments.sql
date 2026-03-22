-- コメントスレッド
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  anchor_shape_id TEXT NOT NULL,
  anchor_x REAL NOT NULL DEFAULT 0,
  anchor_y REAL NOT NULL DEFAULT 0,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_comments_board ON comments(board_id);
CREATE INDEX idx_comments_shape ON comments(anchor_shape_id);

-- コメントメッセージ
CREATE TABLE comment_messages (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_comment_messages_comment ON comment_messages(comment_id);
