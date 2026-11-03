import { getDatabase } from '#lib/server/db';
import { buildStatus } from '#lib/server/api/queries';
import { nowSec } from '#lib/server/api/http';
import type { LayoutServerLoad } from './$types';

/** Datenstand für die Fußzeile: jüngster erfolgreicher Abruf über alle Jobs. */
export const load: LayoutServerLoad = () => {
	const { db } = getDatabase();
	const now = nowSec();
	const status = buildStatus(db, now);
	const okTimes = Object.values(status.jobs)
		.map((j) => j.lastOkTs)
		.filter((t): t is number => t !== null);

	return {
		stand: okTimes.length > 0 ? Math.max(...okTimes) : null,
		jobs: Object.fromEntries(
			Object.entries(status.jobs).map(([name, j]) => [
				name,
				{ label: j.freshness.label, state: j.freshness.state }
			])
		)
	};
};
