CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ouid` text,
	`group` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_ouid_unique` ON `user` (`ouid`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `available_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`group_metadata` text,
	`max_members` integer NOT NULL,
	`join_group_password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `available_groups_number_unique` ON `available_groups` (`number`);--> statement-breakpoint
CREATE INDEX `idx_available_groups_number` ON `available_groups` (`number`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`nickname` text,
	`student_id` text NOT NULL,
	`department` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`emergency_contact_name` text NOT NULL,
	`emergency_contact_phone` text NOT NULL,
	`emergency_contact_relationship` text NOT NULL,
	`medical_conditions` text,
	`allergies` text,
	`food_allergies` text,
	`food_limitations` text,
	`team_owned_id` text NOT NULL,
	`team_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_owned_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_student_id_unique` ON `students` (`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_email_unique` ON `students` (`email`);--> statement-breakpoint
CREATE INDEX `idx_students_student_id` ON `students` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_students_email` ON `students` (`email`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`group_number_preference_order` text,
	`is_submitted` integer NOT NULL,
	`result_group_number` text,
	`team_codes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`result_group_number`) REFERENCES `available_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_team_codes_unique` ON `teams` (`team_codes`);