CREATE TABLE `disclosures` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`transaction_id` text,
	`tool` text NOT NULL,
	`destination` text NOT NULL,
	`mode` text NOT NULL,
	`report` text NOT NULL,
	`preview` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_disclosures_workspace_created` ON `disclosures` (`workspace`,`created`);