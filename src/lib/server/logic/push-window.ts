import type { ScoredSlot } from './ampel';
import { formatBerlinTime } from './ampel';

export interface GreenRun {
	from: number;
	to: number;
	avgEurMwh: number | null;
}

/**
 * Frühester zusammenhängender grüner Abschnitt, der im Bereich [rangeFrom, rangeTo) liegt
 * und mindestens `minDurationSec` lang ist. Der Abschnitt wird auf den Bereich begrenzt.
 */
export function findGreenRun(
	scored: readonly ScoredSlot[],
	rangeFrom: number,
	rangeTo: number,
	minDurationSec: number
): GreenRun | null {
	const slots = scored
		.filter((s) => s.farbe === 'gruen' && s.ts >= rangeFrom && s.ts < rangeTo)
		.sort((a, b) => a.ts - b.ts);

	let run: ScoredSlot[] = [];
	const finish = (): GreenRun | null => {
		if (run.length === 0) return null;
		const from = run[0]!.ts;
		const to = Math.min(run[run.length - 1]!.ts + run[run.length - 1]!.resolutionSec, rangeTo);
		if (to - from < minDurationSec) return null;
		const priced = run.filter((s) => s.priceEurMwh !== null);
		const weight = priced.reduce((sum, s) => sum + s.resolutionSec, 0);
		const avgEurMwh =
			weight > 0
				? priced.reduce((sum, s) => sum + s.priceEurMwh! * s.resolutionSec, 0) / weight
				: null;
		return { from, to, avgEurMwh };
	};

	for (const slot of slots) {
		const last = run[run.length - 1];
		if (last && last.ts + last.resolutionSec !== slot.ts) {
			const found = finish();
			if (found) return found;
			run = [];
		}
		run.push(slot);
	}
	return finish();
}

/** "11–14 Uhr" bei vollen Stunden, sonst "11:30–14 Uhr". Zeiten in Europe/Berlin. */
export function formatHourRange(fromSec: number, toSec: number): string {
	const short = (sec: number) => {
		const hhmm = formatBerlinTime(sec);
		return hhmm.endsWith(':00') ? hhmm.slice(0, -3) : hhmm;
	};
	return `${short(fromSec)}–${short(toSec)} Uhr`;
}
