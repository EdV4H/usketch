-- デモボード（もとは Lobby のボード）を必ず置く（#1558 R6）。地域の一覧 API が
-- 一覧が空のときにだけ作っていたので、Lobby の無い環境があった。あれば何もしない。
INSERT OR IGNORE INTO `user` (`id`, `name`, `email`, `emailVerified`, `createdAt`, `updatedAt`)
VALUES ('system', 'System', 'system@usketch.local', 0, CAST(strftime('%s', 'now') AS INTEGER), CAST(strftime('%s', 'now') AS INTEGER));
--> statement-breakpoint
INSERT OR IGNORE INTO `boards` (`id`, `title`, `owner_id`, `is_public`)
VALUES ('community-lobby', 'uSketch Demo', 'system', 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `community_boards` (`board_id`, `slug`, `display_name`, `description`, `theme_color`, `icon`, `grid_x`, `grid_y`, `sort_order`)
VALUES ('community-lobby', 'lobby', 'uSketch Demo', 'メインロビー', '#6366f1', '🏠', 0, 0, 0);
