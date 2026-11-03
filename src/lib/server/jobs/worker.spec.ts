import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { logFetch } from '../db/repo';
import { freshnessReport } from './worker';

const NOW = 1_800_000_000;

let opened: OpenedDatabase;

beforeEach(() => {
	opened = openDatabase(':memory:');
});

afterEach(() => {
	opened.sqlite.close();
});

describe('freshnessReport', () => {
	it('meldet alle Jobs als "keine Daten", solange nichts erfolgreich war', () => {
		const report = freshnessReport(opened.db, NOW);
		expect(Object.values(report).map((f) => f.label)).toEqual([
			'keine Daten',
			'keine Daten',
			'keine Daten'
		]);
	});

	it('bewertet jeden Job mit seiner eigenen Toleranz', () => {
		// 45 Minuten alt: Strommix (30 min Toleranz) veraltet, Preise (2 h) noch frisch.
		logFetch(opened.db, {
			job: 'generation',
			source: 'energy-charts',
			ok: true,
			ts: NOW - 45 * 60
		});
		logFetch(opened.db, { job: 'prices', source: 'energy-charts', ok: true, ts: NOW - 45 * 60 });

		const report = freshnessReport(opened.db, NOW);
		expect(report.generation).toMatchObject({ state: 'stale', label: 'veraltet seit 45 Min' });
		expect(report.prices).toMatchObject({ state: 'fresh', label: 'Daten frisch' });
		expect(report.renewable_forecast).toMatchObject({ state: 'unknown' });
	});
});
