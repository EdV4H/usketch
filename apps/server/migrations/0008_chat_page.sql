ALTER TABLE `chat_messages` ADD `page_id` text;--> statement-breakpoint
CREATE INDEX `idx_chat_messages_page` ON `chat_messages` (`board_id`,`page_id`,`thread_id`,`created_at`);
