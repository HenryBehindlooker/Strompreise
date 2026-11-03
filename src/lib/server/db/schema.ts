import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/*
 * Alle Zeitstempel sind Unix-Sekunden in UTC und markieren den Beginn des Intervalls.
 * `resolution_sec` wird pro Zeile gespeichert, weil Preise auf 15-Minuten-Raster
 * liegen können und sich die Auflösung im Zeitverlauf ändern kann.
 */

/** Erzeugung je Erzeugungsart in MW. */
export const generation = sqliteTable(
	'generation',
	{
		ts: integer('ts').notNull(),
		sourceType: text('source_type').notNull(),
		resolutionSec: integer('resolution_sec').notNull(),
		mw: real('mw').notNull()
	},
	(t) => [primaryKey({ columns: [t.ts, t.sourceType] })]
);

/** Day-Ahead-Preise in EUR/MWh (Gebotszone DE-LU). */
export const prices = sqliteTable('prices', {
	ts: integer('ts').primaryKey(),
	resolutionSec: integer('resolution_sec').notNull(),
	eurMwh: real('eur_mwh').notNull()
});

/** Erneuerbaren-Anteil in Prozent, getrennt für Ist (0) und Prognose (1). */
export const renewableShare = sqliteTable(
	'renewable_share',
	{
		ts: integer('ts').notNull(),
		resolutionSec: integer('resolution_sec').notNull(),
		pct: real('pct').notNull(),
		isForecast: integer('is_forecast', { mode: 'boolean' }).notNull()
	},
	(t) => [primaryKey({ columns: [t.ts, t.isForecast] })]
);

/** Protokoll jedes Abrufs. Grundlage für die Frische-Anzeige. */
export const fetchLog = sqliteTable(
	'fetch_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		job: text('job').notNull(),
		source: text('source').notNull(),
		ok: integer('ok', { mode: 'boolean' }).notNull(),
		ts: integer('ts').notNull(),
		error: text('error'),
		createdAt: integer('created_at')
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [index('fetch_log_job_ok_ts').on(t.job, t.ok, t.ts)]
);

/** Web-Push-Abonnements. Nur Endpoint und Schlüssel; keine personenbezogenen Daten. */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
	endpoint: text('endpoint').primaryKey(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: integer('created_at')
		.notNull()
		.default(sql`(unixepoch())`)
});

/** Protokoll versendeter Tagesbenachrichtigungen (Berliner Datum YYYY-MM-DD), damit pro Tag nur einmal gesendet wird. */
export const pushSent = sqliteTable('push_sent', {
	day: text('day').primaryKey(),
	sentAt: integer('sent_at').notNull(),
	recipients: integer('recipients').notNull()
});
