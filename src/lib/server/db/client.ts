import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

export interface OpenedDatabase {
	db: Db;
	sqlite: Database.Database;
}

/**
 * Öffnet die SQLite-Datei (oder ":memory:") und wendet ausstehende Migrationen an.
 * `migrationsFolder` ist standardmäßig `src/lib/server/db/migrations` relativ zum
 * Arbeitsverzeichnis; über `MIGRATIONS_DIR` überschreibbar (z. B. im Docker-Image).
 */
export function openDatabase(
	path: string,
	migrationsFolder = defaultMigrationsFolder()
): OpenedDatabase {
	if (path !== ':memory:') {
		mkdirSync(dirname(resolve(path)), { recursive: true });
	}
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');

	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder });
	return { db, sqlite };
}

export function defaultMigrationsFolder(): string {
	return resolve(process.env.MIGRATIONS_DIR ?? 'src/lib/server/db/migrations');
}
