<script lang="ts">
	import type { PageProps } from './$types';
	import AmpelHero from '#lib/components/AmpelHero.svelte';
	import WindowList from '#lib/components/WindowList.svelte';
	import Figure from '#lib/components/Figure.svelte';
	import UPlotChart, { type ChartSeries } from '#lib/components/UPlotChart.svelte';
	import { de } from '#lib/i18n/de';
	import { formatEurMwh, formatMw, formatPct, formatTime, formatDayTime } from '#lib/format';

	let { data }: PageProps = $props();

	// Preis und EE-Anteil haben unterschiedliche Skalen: eigene Diagramme statt Doppel-Achse.
	const priceTs = $derived(data.forecast.prices.map((p) => p.ts));
	const priceSeries = $derived<ChartSeries[]>([
		{
			label: 'Preis',
			colorVar: '--series-1',
			values: data.forecast.prices.map((p) => p.eurMwh),
			kind: 'line'
		}
	]);
	const renewableTs = $derived(data.forecast.renewableForecast.map((p) => p.ts));
	const renewableSeries = $derived<ChartSeries[]>([
		{
			label: 'EE-Anteil',
			colorVar: '--series-3',
			values: data.forecast.renewableForecast.map((p) => p.pct),
			kind: 'area'
		}
	]);

	const mixTs = $derived(data.mix.ts);
	const mixSeries = $derived<ChartSeries[]>(
		data.mix.series.map((s, i) => ({
			label: s.key === 'sonstige' ? de.charts.other : s.label,
			colorVar: s.key === 'sonstige' ? '--series-other' : `--series-${i + 1}`,
			values: s.values,
			kind: 'area'
		}))
	);
</script>

<svelte:head>
	<title>{de.appName}</title>
	<meta
		name="description"
		content="Ist jetzt ein günstiger Zeitpunkt, Strom zu verbrauchen? Strompreis, Erneuerbaren-Anteil und Zeitfenster für Deutschland."
	/>
</svelte:head>

<h1 class="titel">{de.appName}</h1>

<div class="raster">
	<AmpelHero farbe={data.ampel.farbe} symbol={data.ampel.symbol} text={data.ampel.text} />

	<dl class="kennzahlen">
		<div>
			<dt>Strompreis jetzt</dt>
			<dd>{formatEurMwh(data.price?.eurMwh ?? null)}</dd>
		</div>
		<div>
			<dt>EE-Anteil jetzt</dt>
			<dd>{formatPct(data.renewableSharePct)}</dd>
		</div>
	</dl>

	<section class="block" aria-labelledby="fenster-titel">
		<h2 id="fenster-titel">{de.windows.title}</h2>
		<p class="untertitel">{de.windows.subtitle}</p>
		<WindowList windows={data.windows} note={data.windowsNote} />
	</section>

	<Figure
		title={de.charts.price}
		caption={de.charts.priceCaption}
		tableHead={[de.charts.time, 'EUR/MWh']}
		tableRows={data.forecast.prices.map((p) => [formatDayTime(p.ts), formatEurMwh(p.eurMwh)])}
	>
		<UPlotChart
			label={de.charts.price}
			ts={priceTs}
			series={priceSeries}
			unit="EUR/MWh"
			xFormat="day"
			syncKey="forecast"
		/>
	</Figure>

	<Figure
		title={de.charts.renewable}
		caption={de.charts.renewableCaption}
		tableHead={[de.charts.time, '%']}
		tableRows={data.forecast.renewableForecast.map((p) => [formatDayTime(p.ts), formatPct(p.pct)])}
	>
		<UPlotChart
			label={de.charts.renewable}
			ts={renewableTs}
			series={renewableSeries}
			unit="%"
			xFormat="day"
			syncKey="forecast"
		/>
	</Figure>

	<Figure
		title={de.charts.mix}
		caption={de.charts.mixCaption}
		tableHead={[
			de.charts.time,
			...data.mix.series.map((s) => (s.key === 'sonstige' ? de.charts.other : s.label))
		]}
		tableRows={data.mix.ts.map((ts, t) => [
			formatTime(ts),
			...data.mix.series.map((s) => formatMw(s.values[t] ?? 0))
		])}
	>
		<UPlotChart
			label={de.charts.mix}
			ts={mixTs}
			series={mixSeries}
			stacked={true}
			unit="MW"
			xFormat="time"
		/>
	</Figure>
</div>

<style>
	.titel {
		font-size: 1.75rem;
		margin: 0 0 1rem;
	}
	.raster {
		display: grid;
		gap: 1rem;
	}
	.kennzahlen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 0;
	}
	.kennzahlen > div {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
	}
	.kennzahlen dt {
		color: var(--text-secondary);
		font-size: 0.875rem;
	}
	.kennzahlen dd {
		margin: 0.15rem 0 0;
		font-size: 1.35rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.block h2 {
		font-size: 1.15rem;
		margin: 0;
	}
	.untertitel {
		margin: 0.2rem 0 0.75rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}
	@media (min-width: 48rem) {
		.raster {
			grid-template-columns: 1fr 1fr;
		}
		.raster > :global(.figure),
		.raster > .block {
			grid-column: 1 / -1;
		}
	}
</style>
