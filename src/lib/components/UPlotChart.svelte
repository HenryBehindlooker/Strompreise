<script lang="ts">
	import 'uplot/dist/uPlot.min.css';
	import { formatDayShort, formatTime } from '#lib/format';
	import { de } from '#lib/i18n/de';

	export interface ChartSeries {
		label: string;
		/** Name der CSS-Variable mit der Serienfarbe, z. B. "--series-1". */
		colorVar: string;
		values: (number | null)[];
		kind: 'line' | 'area';
	}

	interface Props {
		/** Zeitpunkte in Unix-Sekunden, aufsteigend. */
		ts: number[];
		series: ChartSeries[];
		/** Gestapelte Flächen: Serien werden kumuliert gezeichnet (größte Fläche zuerst). */
		stacked?: boolean;
		/** Achsenbeschriftung für die X-Achse. */
		xFormat?: 'time' | 'day';
		unit: string;
		/** Gemeinsame Cursor-Gruppe, damit mehrere Diagramme gleichzeitig mitlaufen. */
		syncKey?: string;
		height?: number;
		label: string;
	}

	let {
		ts,
		series,
		stacked = false,
		xFormat = 'time',
		unit,
		syncKey,
		height = 220,
		label
	}: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let version = $state(0);
	let plot: { destroy(): void; setSize(s: { width: number; height: number }): void } | null = null;

	const hasData = $derived(ts.length > 0 && series.some((s) => s.values.some((v) => v !== null)));

	/** Kumulierte Summen für gestapelte Flächen (Serie i = Summe der Serien 0..i). */
	function cumulate(values: (number | null)[][]): number[][] {
		const out: number[][] = [];
		values.forEach((col, i) => {
			out.push(col.map((v, t) => (v ?? 0) + (i === 0 ? 0 : out[i - 1]![t]!)));
		});
		return out;
	}

	function withAlpha(color: string): string {
		return color.startsWith('#') && color.length === 7 ? `${color}99` : color;
	}

	// Theme-Wechsel (Systemeinstellung) ändert die Farben: Diagramm neu aufbauen.
	$effect(() => {
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => (version += 1);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	$effect(() => {
		// Abhängigkeiten synchron lesen, damit Svelte sie verfolgt.
		const xs = ts;
		const defs = series;
		const isStacked = stacked;
		const fmtX = xFormat;
		const sync = syncKey;
		void version;
		if (!container || xs.length === 0) return;

		let cancelled = false;
		const el = container;
		const style = getComputedStyle(el);
		const token = (name: string) => style.getPropertyValue(name).trim() || '#888';
		const textSec = token('--text-secondary');
		const grid = token('--grid');

		(async () => {
			const { default: uPlot } = await import('uplot');
			if (cancelled) return;

			const columns = defs.map((s) => s.values);
			const drawn = isStacked ? cumulate(columns) : columns;
			// Gestapelt: größte kumulierte Fläche zuerst zeichnen, damit kleinere davor liegen.
			const order = isStacked ? drawn.map((_, i) => i).reverse() : drawn.map((_, i) => i);
			const data: uPlot.AlignedData = [xs, ...order.map((i) => drawn[i]!)] as uPlot.AlignedData;

			const seriesOpts: uPlot.Series[] = order.map((i) => {
				const def = defs[i]!;
				const color = token(def.colorVar);
				return {
					label: def.label,
					stroke: color,
					width: 2,
					fill: def.kind === 'area' || isStacked ? withAlpha(color) : undefined,
					points: { show: false },
					spanGaps: false
				};
			});

			const width = Math.max(el.clientWidth, 240);
			const opts: uPlot.Options = {
				width,
				height,
				series: [{ label: 'Zeit' }, ...seriesOpts],
				axes: [
					{
						stroke: textSec,
						grid: { stroke: grid, width: 1 },
						ticks: { stroke: grid, width: 1 },
						values: (_u, splits) =>
							splits.map((v) => (fmtX === 'day' ? formatDayShort(v) : formatTime(v)))
					},
					{
						stroke: textSec,
						grid: { stroke: grid, width: 1 },
						ticks: { stroke: grid, width: 1 },
						label: unit,
						labelFont: `12px system-ui`,
						values: (_u, splits) => splits.map((v) => String(Math.round(v * 10) / 10))
					}
				],
				cursor: {
					drag: { x: false, y: false },
					sync: sync ? { key: sync } : undefined
				},
				legend: { show: !isStacked, live: true },
				scales: { x: { time: true } }
			};

			plot?.destroy();
			plot = new uPlot(opts, data, el);
		})();

		return () => {
			cancelled = true;
			plot?.destroy();
			plot = null;
		};
	});

	// Größe bei Änderung der Containerbreite anpassen (ohne Neuaufbau).
	$effect(() => {
		if (!container) return;
		const el = container;
		const observer = new ResizeObserver(() => {
			plot?.setSize({ width: Math.max(el.clientWidth, 240), height });
		});
		observer.observe(el);
		return () => observer.disconnect();
	});
</script>

<div class="chart" role="group" aria-label={label}>
	{#if hasData}
		<div class="chart__canvas" bind:this={container}></div>
	{:else}
		<p class="chart__leer">{de.charts.empty}</p>
	{/if}

	{#if series.length >= 2}
		<ul class="chart__legende" aria-label="Legende">
			{#each series as s (s.label)}
				<li>
					<span class="swatch" style={`background: var(${s.colorVar})`} aria-hidden="true"></span>
					{s.label}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.chart__canvas {
		width: 100%;
		min-height: 220px;
	}
	.chart__leer {
		color: var(--text-secondary);
		margin: 0;
		padding: 2rem 0;
		text-align: center;
	}
	.chart__legende {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		padding: 0.5rem 0 0;
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}
	.chart__legende li {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.swatch {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 0.2rem;
		display: inline-block;
	}
</style>
