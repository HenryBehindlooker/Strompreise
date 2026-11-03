CREATE TABLE `push_sent` (
	`day` text PRIMARY KEY NOT NULL,
	`sent_at` integer NOT NULL,
	`recipients` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
