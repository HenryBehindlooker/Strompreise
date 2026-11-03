import { describe, expect, it } from 'vitest';
import { buildMixChartData, cumulativeStack, OTHER_KEY } from './mix';
import type { NormalizedPoint } from '../sources/types';

const point = (ts: number, values: Record<string, number>): NormalizedPoint => ({
	ts,
	resolutionSec: 900,
	values
});

describe('buildMixChartData', () => {
	it('sortiert nach Zeit und ordnet Serien nach Energie (größte zuerst)', () => {
		const data = buildMixChartData([
			point(900, { wind_onshore: 100, solar: 10 }),
			point(0, { wind_onshore: 300, solar: 20 })
		]);
		expect(data.ts).toEqual([0, 900]);
		expect(data.series.map((s) => s.key)).toEqual(['wind_onshore', 'solar']);
		expect(data.series[0]).toMatchObject({ label: 'Wind an Land', values: [300, 100] });
	});

	it('fasst Erzeugungsarten jenseits der Obergrenze zu "Sonstige" zusammen', () => {
		const data = buildMixChartData([point(0, { a: 50, b: 40, c: 30, d: 20 })], 2);
		expect(data.series.map((s) => s.key)).toEqual(['a', 'b', OTHER_KEY]);
		expect(data.series[2]).toMatchObject({ label: 'Sonstige', values: [50] });
	});

	it('zählt fehlende Werte als 0 und lässt Arten ohne Energie weg', () => {
		const data = buildMixChartData([
			point(0, { solar: 100, wind_onshore: 0 }),
			point(900, { wind_onshore: 200 })
		]);
		expect(data.series.map((s) => s.key)).toEqual(
			['wind_onshore', 'solar'].filter((k) => k !== 'wind_onshore' || true).slice(0, 2).length
				? ['wind_onshore', 'solar']
				: []
		);
		expect(data.series.find((s) => s.key === 'solar')?.values).toEqual([100, 0]);
	});

	it('liefert eine leere Struktur ohne Daten', () => {
		expect(buildMixChartData([])).toEqual({ ts: [], series: [] });
	});

	it('zeigt unbekannte Schlüssel unverändert an', () => {
		const data = buildMixChartData([point(0, { exotic_source: 5 })]);
		expect(data.series[0]?.label).toBe('exotic_source');
	});
});

describe('cumulativeStack', () => {
	it('summiert Serien von unten nach oben, je Zeitpunkt', () => {
		expect(
			cumulativeStack([
				[1, 2],
				[10, 20],
				[100, 200]
			])
		).toEqual([
			[1, 2],
			[11, 22],
			[111, 222]
		]);
	});

	it('gibt bei keiner Serie eine leere Liste zurück', () => {
		expect(cumulativeStack([])).toEqual([]);
	});
});
it('zählt fehlende Werte als 0 MW', () => {
	const data = buildMixChartData([
		point(0, { solar: 100 }),
		point(900, { wind_onshore: 200, solar: 100 })
	]);
	expect(data.series.find((s) => s.key === 'wind_onshore')?.values).toEqual([0, 200]);
	expect(data.series.find((s) => s.key === 'solar')?.values).toEqual([100, 100]);
});

it('lässt Erzeugungsarten ohne Energie weg', () => {
	const data = buildMixChartData([point(0, { idle: 0, solar: 5 })]);
	expect(data.series.map((s) => s.key)).toEqual(['solar']);
});
