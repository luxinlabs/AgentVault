CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`result` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_evaluations_workspace_created` ON `evaluations` (`workspace`,`created`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`run_id` text NOT NULL,
	`scenario` text NOT NULL,
	`invoice` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`evidence` text NOT NULL,
	`assessment` text NOT NULL,
	`trace` text NOT NULL,
	`verification` text,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_workspace_created` ON `transactions` (`workspace`,`created`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`policy` text NOT NULL,
	`created` text NOT NULL
);
