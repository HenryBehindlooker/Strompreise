<script lang="ts">
	import { de } from '#lib/i18n/de';
	import { formatEurMwh, formatPct, formatWindow } from '#lib/format';

	interface Window {
		from: number;
		to: number;
		score: number;
		avgEurMwh: number | null;
		avgRenewableSharePct: number | null;
	}

	interface Props {
		windows: Window[];
		note: string | null;
	}

	let { windows, note }: Props = $props();
</script>

{#if windows.length === 0}
	<p class="leer">{note ?? de.windows.empty}</p>
{:else}
	<ol class="fenster">
		{#each windows as w, i (w.from)}
			<li>
				<span class="rang" aria-hidden="true">{i + 1}</span>
				<div class="fenster__text">
					<p class="fenster__zeit"><strong>{formatWindow(w.from, w.to)}</strong></p>
					<p class="fenster__werte">
						<span>{de.windows.avgPrice}: {formatEurMwh(w.avgEurMwh)}</span>
						<span>{de.windows.avgRenewable}: {formatPct(w.avgRenewableSharePct)}</span>
					</p>
				</div>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.leer {
		color: var(--text-secondary);
		margin: 0;
	}
	.fenster {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
	}
	.fenster li {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
	}
	.rang {
		flex: 0 0 auto;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: var(--text-primary);
		color: var(--surface-1);
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 0.9rem;
	}
	.fenster__text {
		min-width: 0;
	}
	.fenster__zeit {
		margin: 0;
	}
	.fenster__werte {
		margin: 0.2rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}
</style>
