CREATE TABLE `active_buffs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`buff_type` text NOT NULL,
	`multiplier` integer NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cap_amount` integer NOT NULL,
	`granted_amount` integer DEFAULT 0 NOT NULL,
	`source_purchase_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_buffs_source_purchase_id_unique` ON `active_buffs` (`source_purchase_id`);--> statement-breakpoint
CREATE INDEX `idx_active_buffs_user` ON `active_buffs` (`user_id`);--> statement-breakpoint
CREATE TABLE `points_balances` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ouid` text NOT NULL,
	`delta` integer NOT NULL,
	`source` text NOT NULL,
	`ref_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_points_ledger_user` ON `points_ledger` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_points_ledger_source_ref` ON `points_ledger` (`source`,`ref_id`);--> statement-breakpoint
CREATE TABLE `shop_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item` text NOT NULL,
	`points_cost` integer NOT NULL,
	`result_ref` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_shop_redemptions_user` ON `shop_redemptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `minigame_plays` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_type` text NOT NULL,
	`ticket_id` text,
	`play_token` text NOT NULL,
	`status` text DEFAULT 'started' NOT NULL,
	`server_state` text,
	`result_payload` text,
	`points_awarded` integer,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticket_id`) REFERENCES `minigame_tickets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `minigame_plays_play_token_unique` ON `minigame_plays` (`play_token`);--> statement-breakpoint
CREATE INDEX `idx_minigame_plays_user_game_created` ON `minigame_plays` (`user_id`,`game_type`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_minigame_plays_ticket` ON `minigame_plays` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `minigame_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_type` text NOT NULL,
	`status` text DEFAULT 'unused' NOT NULL,
	`source_purchase_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `minigame_tickets_source_purchase_id_unique` ON `minigame_tickets` (`source_purchase_id`);--> statement-breakpoint
CREATE INDEX `idx_minigame_tickets_user` ON `minigame_tickets` (`user_id`);--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`question_text` text NOT NULL,
	`choices` text NOT NULL,
	`correct_choice_index` integer NOT NULL,
	`points` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `friend_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`adder_user_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	`same_group` integer NOT NULL,
	`reward_rank` integer NOT NULL,
	`reward_points` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`adder_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_friend_edges_adder` ON `friend_edges` (`adder_user_id`);--> statement-breakpoint
CREATE INDEX `idx_friend_edges_target` ON `friend_edges` (`target_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_friend_edges_adder_target` ON `friend_edges` (`adder_user_id`,`target_user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `friend_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_friend_code_unique` ON `user` (`friend_code`);