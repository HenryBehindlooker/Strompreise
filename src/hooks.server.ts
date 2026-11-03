import { getDatabase } from './lib/server/db';
import { getSources } from './lib/server/sources';
import { startWorker } from './lib/server/jobs/worker';

const KEY = '__strompreiseWorker';

// Startet den Worker einmal pro Prozess, sobald der Server die Hooks lädt.
const g = globalThis as unknown as Record<string, unknown>;
if (process.env.JOBS_ENABLED !== 'false' && !g[KEY]) {
	const sources = getSources();
	if (sources.length === 0) {
		console.warn('[worker] Keine Datenquelle konfiguriert, Jobs werden nicht gestartet.');
	} else {
		const { db } = getDatabase();
		g[KEY] = startWorker({ db, sources, now: () => Math.floor(Date.now() / 1000) });
	}
}
