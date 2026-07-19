CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`sync_key` text NOT NULL,
	`cursor` integer,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_sync_key_unique` ON `sync_state` (`sync_key`);