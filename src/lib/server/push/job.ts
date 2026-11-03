import type { AmpelConfig } from '../logic/ampel';
import { scoreSlots } from '../logic/ampel';
import { findGreenRun, formatHourRange } from '../logic/push-window';
import { berlinDateKey, berlinDayRange, berlinTimeOnDay } from '../logic/time';
import { loadSlots } from '../api/queries';
import type { JobDeps } from '../jobs/tasks';
import { alreadySentFor, notifyAll, type NotifyResult, type PushSender } from './service';

export const PUSH_WINDOW = { fromHour: 11, toHour: 14, minDurationSec: 3600 } as const;

export interface PushJobOptions {
	sender: PushSender;
	ampel: AmpelConfig;
}

export type PushJobResult =
	| { skipped: 'already-sent' | 'no-green-window' }
	| ({ skipped: NotifyResult['skipped'] } & Omit<NotifyResult, 'skipped'> & { window: string });

/**
 * Tägliche Nachricht am Abend: "Morgen 11–14 Uhr grünes Fenster", wenn es morgen zwischen
 * 11 und 14 Uhr einen zusammenhängenden grünen Abschnitt von mindestens einer Stunde gibt.
 * Die Prüfung läuft nach der Veröffentlichung der Day-Ahead-Preise (ca. 13 Uhr).
 */
export async function runPushJob(deps: JobDeps, options: PushJobOptions): Promise<PushJobResult> {
	const now = deps.now();
	const tomorrow = berlinDayRange(now, 1);
	const day = berlinDateKey(tomorrow.from + 12 * 3600);

	if (alreadySentFor(deps.db, day)) {
		return { skipped: 'already-sent' };
	}

	const rangeFrom = berlinTimeOnDay(now, 1, PUSH_WINDOW.fromHour);
	const rangeTo = berlinTimeOnDay(now, 1, PUSH_WINDOW.toHour);
	const scored = scoreSlots(loadSlots(deps.db, now), options.ampel);
	const run = findGreenRun(scored, rangeFrom, rangeTo, PUSH_WINDOW.minDurationSec);
	if (!run) {
		return { skipped: 'no-green-window' };
	}

	const window = formatHourRange(run.from, run.to);
	const result = await notifyAll(
		deps.db,
		options.sender,
		{ title: 'Strom-Ampel', body: `Morgen ${window} grünes Fenster`, url: '/' },
		day,
		now
	);
	return { ...result, window };
}
