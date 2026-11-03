import { getDatabase } from './lib/server/db';
import { getSources } from './lib/server/sources';
import { startWorker } from './lib/server/jobs/worker';
import { ampelConfigFromEnv } from './lib/server/logic/ampel';
import { runPushJob } from './lib/server/push/job';
import { createWebPushSender, pushConfigFromEnv } from './lib/server/push/service';

const KEY = '__strompreiseWorker';

// Startet den Worker einmal pro Prozess, sobald der Server die Hooks lädt.
const g = globalThis as unknown as Record<string, unknown>;
if (process.env.JOBS_ENABLED !== 'false' && !g[KEY]) {
	const sources = getSources();
	if (sources.length === 0) {
		console.warn('[worker] Keine Datenquelle konfiguriert, Jobs werden nicht gestartet.');
	} else {
		const { db } = getDatabase();
		const now = () => Math.floor(Date.now() / 1000);
		const deps = { db, sources, now };

		// Web-Push ist nur aktiv, wenn VAPID-Schlüssel gesetzt sind.
		const pushConfig = pushConfigFromEnv(process.env);
		const extras = pushConfig
			? {
					pushJob: () =>
						runPushJob(deps, {
							sender: createWebPushSender(pushConfig),
							ampel: ampelConfigFromEnv(process.env)
						})
				}
			: {};

		g[KEY] = startWorker(deps, extras);
	}
}
