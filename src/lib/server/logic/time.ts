/**
 * Zeit-Helfer. Intern wird ausschließlich in Unix-Sekunden (UTC) gerechnet.
 * Europe/Berlin wird nur an den Rändern benutzt: für Kalendertage und Anzeige.
 */

export const BERLIN_TZ = 'Europe/Berlin';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: BERLIN_TZ,
	hourCycle: 'h23',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
});

interface WallParts {
	year: number;
	month: number; // 1–12
	day: number;
}

function berlinWallParts(utcMs: number): WallParts {
	const parts = partsFormatter.formatToParts(new Date(utcMs));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return { year: get('year'), month: get('month'), day: get('day') };
}

/** Offset Berlin − UTC in Millisekunden zum gegebenen Zeitpunkt. */
function berlinOffsetMs(utcMs: number): number {
	const parts = partsFormatter.formatToParts(new Date(utcMs));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const wallAsUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	);
	return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/** UTC-Sekunden des Mitternachts-Beginns (Europe/Berlin) für das Kalenderdatum. */
export function berlinMidnight(year: number, month: number, day: number): number {
	// Date.UTC normalisiert Überläufe (z. B. Tag 32 → nächster Monat).
	const normalized = new Date(Date.UTC(year, month - 1, day));
	const guess = normalized.getTime();
	const firstOffset = berlinOffsetMs(guess);
	let candidate = guess - firstOffset;
	const secondOffset = berlinOffsetMs(candidate);
	if (secondOffset !== firstOffset) {
		candidate = guess - secondOffset;
	}
	return Math.floor(candidate / 1000);
}

export interface DayRange {
	/** Beginn (Mitternacht Europe/Berlin), Unix-Sekunden UTC. */
	from: number;
	/** Beginn des Folgetags (exklusiv), Unix-Sekunden UTC. */
	to: number;
}

/** Berliner Kalendertag, der `nowSec` enthält, verschoben um `offsetDays`. */
export function berlinDayRange(nowSec: number, offsetDays = 0): DayRange {
	const { year, month, day } = berlinWallParts(nowSec * 1000);
	const dayStart = new Date(Date.UTC(year, month - 1, day + offsetDays));
	const y = dayStart.getUTCFullYear();
	const m = dayStart.getUTCMonth() + 1;
	const d = dayStart.getUTCDate();
	return {
		from: berlinMidnight(y, m, d),
		to: berlinMidnight(y, m, d + 1)
	};
}
