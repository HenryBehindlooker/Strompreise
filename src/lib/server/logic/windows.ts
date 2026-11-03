import type { ScoredSlot } from './ampel';

export interface WindowCandidate {
	from: number;
	to: number;
	/** Zeitgewichteter Mittelwert der Intervall-Scores, 0–1. */
	score: number;
	/** Zeitgewichteter Durchschnittspreis, null wenn keine Preise im Fenster. */
	avgEurMwh: number | null;
	/** Zeitgewichteter EE-Anteil in Prozent, null wenn keine Prognose im Fenster. */
	avgRenewableSharePct: number | null;
}

export interface WindowOptions {
	durationSec: number;
	count: number;
	/** Fenster beginnen frühestens bei diesem Zeitpunkt (Unix-Sekunden). */
	notBefore: number;
}

/** Zeitgewichteter Mittelwert; Einträge mit null werden übersprungen. */
function weightedMean(items: readonly { value: number | null; weight: number }[]): number | null {
	let sum = 0;
	let weight = 0;
	for (const item of items) {
		if (item.value === null) continue;
		sum += item.value * item.weight;
		weight += item.weight;
	}
	return weight > 0 ? sum / weight : null;
}

/**
 * Sucht zusammenhängende Fenster exakter Länge `durationSec`, die nur aus bewerteten
 * Intervallen ohne Lücke bestehen, und wählt davon die besten `count` ohne Überlappung.
 *
 * Ein Fenster endet genau auf einer Intervallgrenze. Passt die Länge nicht auf die
 * Intervallraster (z. B. 90 min bei reinen Stundenwerten), gibt es dort keine Kandidaten.
 */
export function findBestWindows(
	scored: readonly ScoredSlot[],
	options: WindowOptions
): WindowCandidate[] {
	const { durationSec, count, notBefore } = options;
	if (durationSec <= 0 || count <= 0) {
		return [];
	}

	const valid = scored
		.filter((s) => s.score !== null && s.ts >= notBefore)
		.sort((a, b) => a.ts - b.ts);

	const candidates: WindowCandidate[] = [];
	for (let i = 0; i < valid.length; i++) {
		const members: ScoredSlot[] = [];
		let covered = 0;
		let expectedStart = valid[i]!.ts;

		for (let j = i; j < valid.length; j++) {
			const slot = valid[j]!;
			if (slot.ts !== expectedStart) break; // Lücke
			if (covered + slot.resolutionSec > durationSec) break; // würde über das Fenster hinausgehen
			members.push(slot);
			covered += slot.resolutionSec;
			expectedStart = slot.ts + slot.resolutionSec;
			if (covered === durationSec) {
				candidates.push({
					from: members[0]!.ts,
					to: expectedStart,
					score:
						weightedMean(members.map((m) => ({ value: m.score, weight: m.resolutionSec }))) ?? 0,
					avgEurMwh: weightedMean(
						members.map((m) => ({ value: m.priceEurMwh, weight: m.resolutionSec }))
					),
					avgRenewableSharePct: weightedMean(
						members.map((m) => ({ value: m.renewablePct, weight: m.resolutionSec }))
					)
				});
				break;
			}
		}
	}

	// Beste zuerst; bei Gleichstand das frühere Fenster.
	candidates.sort((a, b) => b.score - a.score || a.from - b.from);

	const picked: WindowCandidate[] = [];
	for (const candidate of candidates) {
		if (picked.length >= count) break;
		const overlaps = picked.some((p) => candidate.from < p.to && p.from < candidate.to);
		if (!overlaps) picked.push(candidate);
	}
	return picked;
}
