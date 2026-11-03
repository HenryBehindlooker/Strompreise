<script lang="ts">
	import { de } from '#lib/i18n/de';

	interface Props {
		farbe: 'gruen' | 'gelb' | 'rot' | null;
		symbol: '✓' | '!' | '✕' | null;
		text: string;
	}

	let { farbe, symbol, text }: Props = $props();

	const label = $derived(farbe ? de.farben[farbe] : de.farben.unbekannt);
	const zustand = $derived(farbe ?? 'unbekannt');
</script>

<section class="ampel ampel--{zustand}" aria-labelledby="ampel-titel">
	<div class="ampel__signal" aria-hidden="true">
		<span class="ampel__symbol">{symbol ?? '–'}</span>
	</div>
	<div class="ampel__text">
		<h2 id="ampel-titel">{de.hero.title}</h2>
		<p class="ampel__farbe">
			<strong>{label}</strong>
		</p>
		<p class="ampel__satz" role="status">{text}</p>
	</div>
</section>

<style>
	.ampel {
		display: flex;
		gap: 1rem;
		align-items: center;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 1.25rem;
	}
	.ampel__signal {
		flex: 0 0 auto;
		width: 5rem;
		height: 5rem;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--sig, var(--border));
		color: var(--sig-on, var(--text-primary));
	}
	.ampel__symbol {
		font-size: 2.5rem;
		font-weight: 800;
		line-height: 1;
	}
	.ampel--gruen {
		--sig: var(--status-good);
		--sig-on: var(--status-on-good);
	}
	.ampel--gelb {
		--sig: var(--status-warning);
		--sig-on: var(--status-on-warning);
	}
	.ampel--rot {
		--sig: var(--status-critical);
		--sig-on: var(--status-on-critical);
	}
	.ampel--unbekannt {
		--sig: transparent;
		--sig-on: var(--text-secondary);
		outline: 2px dashed var(--border);
		outline-offset: -2px;
	}
	.ampel__text h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--text-secondary);
		font-weight: 600;
	}
	.ampel__farbe {
		margin: 0.1rem 0 0;
		font-size: 1.5rem;
		line-height: 1.2;
	}
	.ampel__satz {
		margin: 0.25rem 0 0;
		color: var(--text-primary);
	}
</style>
