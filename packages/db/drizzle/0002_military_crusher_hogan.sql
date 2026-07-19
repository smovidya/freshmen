CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activities_code_unique` ON `activities` (`code`);--> statement-breakpoint
CREATE TABLE `checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`activity_id` text NOT NULL,
	`checkpoint_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_checkpoints_activity_id` ON `checkpoints` (`activity_id`);--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`checkpoint_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`checkpoint_id`) REFERENCES `checkpoints`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_scans_activity_id` ON `scans` (`activity_id`);--> statement-breakpoint
CREATE INDEX `idx_scans_staff_id` ON `scans` (`staff_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_scans_student_checkpoint` ON `scans` (`student_id`,`checkpoint_id`);--> statement-breakpoint
CREATE TABLE `staff_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staffs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_staff_activities_staff_activity` ON `staff_activities` (`staff_id`,`activity_id`);--> statement-breakpoint
CREATE TABLE `staffs` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`name` text NOT NULL,
	`nickname` text,
	`staff_role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_staffs_student_id` ON `staffs` (`student_id`);