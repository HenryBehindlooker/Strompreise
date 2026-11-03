import { openDatabase, type OpenedDatabase } from './client';

/**
 * Prozessweite Datenbankverbindung. Liegt auf `globalThis`, damit Vite-HMR im
 * Entwicklungsmodus keine zweite Verbindung öffnet.
 */
const KEY = '__strompreiseDb';

export function getDatabase(): OpenedDatabase {
	const g = globalThis as unknown as Record<string, OpenedDatabase | undefined>;
	if (!g[KEY]) {
		const path = process.env.DATABASE_PATH ?? './data/strompreise.db';
		g[KEY] = openDatabase(path);
	}
	return g[KEY];
}
