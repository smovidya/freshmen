ALTER TABLE `staffs` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
CREATE UNIQUE INDEX `staffs_user_id_unique` ON `staffs` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_student_group` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`group_number` integer NOT NULL,
	`subgroup_number` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_student_group`("id", "student_id", "group_number", "subgroup_number", "created_at", "updated_at") SELECT "id", "student_id", "group_number", "subgroup_number", "created_at", "updated_at" FROM `student_group`;--> statement-breakpoint
DROP TABLE `student_group`;--> statement-breakpoint
ALTER TABLE `__new_student_group` RENAME TO `student_group`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `student_group_student_id_unique` ON `student_group` (`student_id`);