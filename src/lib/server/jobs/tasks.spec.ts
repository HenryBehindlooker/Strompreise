import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { lastSuccessfulFetch, readGeneration, upsertPrices } from '../db/repo';
import { fetchLog, renewableShare } from '../db/schema';
import { berlinDayRange } from '../logic/time';
import { expectedSlots } from '../sources/normalize';
import type { EnergySource, NormalizedPoint } from '../sources/types';
import { PRICE_KEY, RENEWABLE_SHARE_KEY } from '../sources/types';
import {
	AllSourcesFailedError,
	JOB,
	runGenerationJob,
	runPricesJob,
	runRenewableForecastJob,
	type JobDeps
} from './tasks';

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0) / 1000; // Sa, 24.10.2026 14:00 Berlin

function fakeSource(
	name: string,
	impl: Partial<
		Pick<EnergySource, 'getGenerationMix' | 'getPrices' | 'getRenewableShareForecast'>
	> = {}
): EnergySource {
	const none = async (): Promise<NormalizedPoint[]> => {
		throw new Error(`${name}: nicht implementiert`);
	};
	return {
		name,
		getGenerationMix: impl.getGenerationMix ?? none,
		getPrices: impl.getPrices ?? none,
		getRenewableShareForecast: impl.getRenewableShareForecast ?? none
	};
}

const failing = (name: string) =>
	fakeSource(name, {
		getGenerationMix: async () => {
			throw new Error('HTTP 503');
		}
	});

let opened: OpenedDatabase;
let deps: JobDeps;

beforeEach(() => {
	opened = openDatabase(':memory:');
	deps = { db: opened.db, sources: [], now: () => NOW };
});

afterEach(() => {
	opened.sqlite.close();
});

describe('Fallback über Quellen', () => {
	it('nutzt die primäre Quelle, wenn sie antwortet', async () => {
		const primary = fakeSource('energy-charts', {
			getGenerationMix: async () => [{ ts: NOW - 900, resolutionSec: 900, values: { solar: 1 } }]
		});
		const fallback = fakeSource('smard', {
			getGenerationMix: vi.fn(async () => [])
		});
		deps.sources = [primary, fallback];

		const result = await runGenerationJob(deps);

		expect(result).toEqual({ source: 'energy-charts', written: 1 });
		expect(fallback.getGenerationMix).not.toHaveBeenCalled();
	});

	it('fällt bei Fehler der primären Quelle auf die nächste zurück und protokolliert beides', async () => {
		deps.sources = [
			failing('energy-charts'),
			fakeSource('smard', {
				getGenerationMix: async () => [{ ts: NOW - 900, resolutionSec: 900, values: { solar: 5 } }]
			})
		];

		const result = await runGenerationJob(deps);

		expect(result.source).toBe('smard');
		const log = opened.db.select().from(fetchLog).all();
		expect(log.map((l) => [l.source, l.ok])).toEqual([
			['energy-charts', false],
			['smard', true]
		]);
		expect(log[0]?.error).toBe('HTTP 503');
		expect(readGeneration(opened.db, 0, NOW + 1)).toHaveLength(1);
	});

	it('wirft AllSourcesFailedError, wenn alle Quellen versagen, und schreibt nichts', async () => {
		deps.sources = [failing('energy-charts'), failing('smard')];

		await expect(runGenerationJob(deps)).rejects.toBeInstanceOf(AllSourcesFailedError);
		expect(readGeneration(opened.db, 0, NOW + 1)).toEqual([]);
		expect(lastSuccessfulFetch(opened.db, JOB.generation)).toBeNull();
		expect(opened.db.select().from(fetchLog).all()).toHaveLength(2);
	});

	it('behandelt eine leere Antwort als Fehler und geht zur nächsten Quelle', async () => {
		deps.sources = [
			fakeSource('energy-charts', { getGenerationMix: async () => [] }),
			fakeSource('smard', {
				getGenerationMix: async () => [{ ts: NOW - 900, resolutionSec: 900, values: { solar: 2 } }]
			})
		];

		const result = await runGenerationJob(deps);
		expect(result.source).toBe('smard');
		const first = opened.db.select().from(fetchLog).all()[0];
		expect(first).toMatchObject({ source: 'energy-charts', ok: false, error: 'leere Antwort' });
	});
});

describe('runPricesJob', () => {
	const tomorrow = berlinDayRange(NOW, 1);
	const today = berlinDayRange(NOW, 0);

	it('überspringt den Abruf, wenn die Preise für morgen vollständig vorliegen', async () => {
		// Morgen (25.10.2026) hat 25 Stunden, also 100 Viertelstunden.
		upsertPrices(
			opened.db,
			expectedSlots(tomorrow, 900).map((ts) => ({
				ts,
				resolutionSec: 900,
				values: { [PRICE_KEY]: 80 }
			}))
		);
		const source = fakeSource('energy-charts', { getPrices: vi.fn(async () => []) });
		deps.sources = [source];

		const result = await runPricesJob(deps);

		expect(result).toEqual({ skipped: true });
		expect(source.getPrices).not.toHaveBeenCalled();
	});

	it('ruft von heute bis Ende morgen ab, wenn Preise für morgen fehlen', async () => {
		const getPrices = vi.fn(async (): Promise<NormalizedPoint[]> => [
			{ ts: tomorrow.from, resolutionSec: 900, values: { [PRICE_KEY]: 80 } }
		]);
		deps.sources = [fakeSource('energy-charts', { getPrices })];

		const result = await runPricesJob(deps);

		expect(getPrices).toHaveBeenCalledWith(today.from, tomorrow.to);
		expect(result).toMatchObject({ skipped: false, source: 'energy-charts', written: 1 });
	});

	it('ruft erneut ab, wenn eine Lücke in den Preisen für morgen besteht', async () => {
		const slots = expectedSlots(tomorrow, 900);
		// Eine Viertelstunde in der Mitte fehlt.
		upsertPrices(
			opened.db,
			slots
				.filter((_, i) => i !== 40)
				.map((ts) => ({ ts, resolutionSec: 900, values: { [PRICE_KEY]: 80 } }))
		);
		const getPrices = vi.fn(async () => [] as NormalizedPoint[]);
		deps.sources = [fakeSource('energy-charts', { getPrices })];

		await expect(runPricesJob(deps)).rejects.toBeInstanceOf(AllSourcesFailedError);
		expect(getPrices).toHaveBeenCalledTimes(1);
	});
});

describe('runRenewableForecastJob', () => {
	it('speichert die Prognose für 48 Stunden ab der vollen Stunde als Prognose', async () => {
		const from = Math.floor(NOW / 3600) * 3600;
		const getRenewableShareForecast = vi.fn(async (): Promise<NormalizedPoint[]> => [
			{ ts: from, resolutionSec: 3600, values: { [RENEWABLE_SHARE_KEY]: 55 } }
		]);
		deps.sources = [fakeSource('energy-charts', { getRenewableShareForecast })];

		const result = await runRenewableForecastJob(deps);

		expect(getRenewableShareForecast).toHaveBeenCalledWith(from, from + 48 * 3600);
		expect(result).toMatchObject({ source: 'energy-charts', written: 1 });
		expect(opened.db.select().from(renewableShare).all()).toEqual([
			{ ts: from, resolutionSec: 3600, pct: 55, isForecast: true }
		]);
	});
});
