import { getDatabase } from '#lib/server/db';
import { buildForecast, buildMixHistory, buildNow, buildWindows } from '#lib/server/api/queries';
import { nowSec } from '#lib/server/api/http';
import { ampelConfigFromEnv } from '#lib/server/logic/ampel';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { db } = getDatabase();
	const now = nowSec();
	const config = ampelConfigFromEnv(process.env);

	const current = buildNow(db, now, config);
	const windows = buildWindows(db, now, { duration: 3 * 3600, count: 3 }, config);

	return {
		now,
		ampel: current.ampel,
		price: current.price,
		renewableSharePct: current.renewableSharePct,
		windows: windows.windows,
		windowsNote: windows.note,
		forecast: buildForecast(db, now),
		mix: buildMixHistory(db, now)
	};
};
