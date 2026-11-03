import cron, { type ScheduledTask } from 'node-cron';
import { lastSuccessfulFetch } from '../db/repo';
import type { Db } from '../db/client';
import { describeFreshness, type Freshness } from './status';
import {
	JOB,
	runGenerationJob,
	runPricesJob,
	runPruneJob,
	runRenewableForecastJob,
	type JobDeps
} from './tasks';

const MIN = 60;
const HOUR = 60 * MIN;

/** Ab wann ein Job als veraltet gilt, bezogen auf den letzten erfolgreichen Abruf. */
export const STALE_AFTER_SEC: Record<string, number> = {
	[JOB.generation]: 30 * MIN,
	[JOB.prices]: 2 * HOUR,
	[JOB.renewableForecast]: 2 * HOUR
};

export const SCHEDULES = {
	generation: '*/15 * * * *',
	prices: '0 * * * *',
	renewableForecast: '0 * * * *',
	prune: '17 3 * * *',
	push: '0 18 * * *'
} as const;

/** Zusätzliche Jobs, die nur aktiv sind, wenn sie konfiguriert wurden (z. B. Web-Push). */
export interface WorkerExtras {
	pushJob?: () => unknown | Promise<unknown>;
}

export interface WorkerHandle {
	stop(): void;
}

/** Fehler in einem Job dürfen den Cron-Prozess nicht beenden. Sie werden geloggt. */
async function guard(name: string, fn: () => unknown | Promise<unknown>): Promise<void> {
	try {
		await fn();
	} catch (error) {
		console.error(
			`[worker] ${name} fehlgeschlagen:`,
			error instanceof Error ? error.message : error
		);
	}
}

/**
 * Startet die Hintergrund-Jobs im Server-Prozess. Jeder Job läuft einmal sofort
 * (damit eine leere Datenbank schnell gefüllt wird) und danach nach Zeitplan.
 * `noOverlap` verhindert, dass sich Läufe desselben Jobs überschneiden.
 */
export function startWorker(deps: JobDeps, extras: WorkerExtras = {}): WorkerHandle {
	const tasks: ScheduledTask[] = [];

	const register = (name: string, expression: string, fn: () => unknown) => {
		tasks.push(cron.schedule(expression, () => guard(name, fn), { name, noOverlap: true }));
		void guard(`${name} (Start)`, fn);
	};

	register('generation', SCHEDULES.generation, () => runGenerationJob(deps));
	register('prices', SCHEDULES.prices, () => runPricesJob(deps));
	register('renewable_forecast', SCHEDULES.renewableForecast, () => runRenewableForecastJob(deps));
	tasks.push(
		cron.schedule(SCHEDULES.prune, () => guard('prune', () => runPruneJob(deps)), {
			name: 'prune',
			noOverlap: true
		})
	);

	if (extras.pushJob) {
		// Abends in Berlin, nachdem die Preise für den Folgetag vorliegen sollten.

		const pushJob = extras.pushJob;

		tasks.push(
			cron.schedule(SCHEDULES.push, () => guard('push', pushJob), {
				name: 'push',

				timezone: 'Europe/Berlin',

				noOverlap: true
			})
		);
	}

	return {
		stop() {
			for (const task of tasks) {
				void task.destroy();
			}
		}
	};
}

/** Frische je Job, für /api/status (Phase 3). */
export function freshnessReport(db: Db, nowSec: number): Record<string, Freshness> {
	const report: Record<string, Freshness> = {};
	for (const job of [JOB.generation, JOB.prices, JOB.renewableForecast]) {
		report[job] = describeFreshness(
			lastSuccessfulFetch(db, job),
			nowSec,
			STALE_AFTER_SEC[job] ?? HOUR
		);
	}
	return report;
}
