CREATE TABLE `game_scores` (
	`ouid` text PRIMARY KEY NOT NULL,
	`group_number` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
