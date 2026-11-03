CREATE TABLE `fetch_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job` text NOT NULL,
	`source` text NOT NULL,
	`ok` integer NOT NULL,
	`ts` integer NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fetch_log_job_ok_ts` ON `fetch_log` (`job`,`ok`,`ts`);--> statement-breakpoint
CREATE TABLE `generation` (
	`ts` integer NOT NULL,
	`source_type` text NOT NULL,
	`resolution_sec` integer NOT NULL,
	`mw` real NOT NULL,
	PRIMARY KEY(`ts`, `source_type`)
);
--> statement-breakpoint
CREATE TABLE `prices` (
	`ts` integer PRIMARY KEY NOT NULL,
	`resolution_sec` integer NOT NULL,
	`eur_mwh` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `renewable_share` (
	`ts` integer NOT NULL,
	`resolution_sec` integer NOT NULL,
	`pct` real NOT NULL,
	`is_forecast` integer NOT NULL,
	PRIMARY KEY(`ts`, `is_forecast`)
);
