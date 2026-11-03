import type { NormalizedPoint } from '../sources/types';

/** Anzeigenamen für bekannte Erzeugungsarten. Unbekannte Schlüssel werden unverändert angezeigt. */
export const SOURCE_LABELS: Record<string, string> = {
	solar: 'Solar',
	wind_onshore: 'Wind an Land',
	wind_offshore: 'Wind auf See',
	biomass: 'Biomasse',
	hydro: 'Wasserkraft',
	lignite: 'Braunkohle',
	hard_coal: 'Steinkohle',
	gas: 'Erdgas',
	nuclear: 'Kernenergie'
};

export const OTHER_KEY = 'sonstige';

export interface MixChartData {
	/** Beginn je Intervall, Unix-Sekunden UTC, aufsteigend. */
	ts: number[];
	/** Serien in Anzeigereihenfolge (größte zuerst), letzte ggf. "Sonstige". */
	series: { key: string; label: string; values: number[] }[];
}

/**
 * Bereitet den Erzeugungsmix für ein gestapeltes Diagramm vor.
 * Die `maxNamed` größten Erzeugungsarten (nach Energie) bekommen eine eigene Serie,
 * alle übrigen werden zu "Sonstige" zusammengefasst. Fehlende Werte zählen als 0 MW.
 */
export function buildMixChartData(points: readonly NormalizedPoint[], maxNamed = 7): MixChartData {
	const sorted = [...points].sort((a, b) => a.ts - b.ts);
	const ts = sorted.map((p) => p.ts);

	const totals = new Map<string, number>();
	for (const p of sorted) {
		for (const [key, mw] of Object.entries(p.values)) {
			totals.set(key, (totals.get(key) ?? 0) + mw * p.resolutionSec);
		}
	}
	const ranked = [...totals.entries()]
		.filter(([, energy]) => energy > 0)
		.sort((a, b) => b[1] - a[1])
		.map(([key]) => key);

	const named = ranked.slice(0, maxNamed);
	const rest = ranked.slice(maxNamed);

	const valueAt = (p: NormalizedPoint, key: string) => p.values[key] ?? 0;
	const series: MixChartData['series'] = named.map((key) => ({
		key,
		label: SOURCE_LABELS[key] ?? key,
		values: sorted.map((p) => valueAt(p, key))
	}));
	if (rest.length > 0) {
		series.push({
			key: OTHER_KEY,
			label: 'Sonstige',
			values: sorted.map((p) => rest.reduce((sum, key) => sum + valueAt(p, key), 0))
		});
	}
	return { ts, series };
}

/**
 * Kumulierte Summen für gestapelte Flächen: Serie i enthält die Summe der Serien 0..i.
 * Die oberste kumulierte Serie ist also die Gesamterzeugung.
 */
export function cumulativeStack(series: readonly number[][]): number[][] {
	const out: number[][] = [];
	series.forEach((values, i) => {
		out.push(values.map((v, t) => v + (i === 0 ? 0 : out[i - 1]![t]!)));
	});
	return out;
}
