CREATE TABLE `free_claims` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_claimed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
