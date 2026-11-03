<script lang="ts">
	import type { Snippet } from 'svelte';
	import { de } from '#lib/i18n/de';

	interface Props {
		title: string;
		caption: string;
		/** Spaltenköpfe und Zeilen der Tabellenansicht (Gegenstück zum Diagramm). */
		tableHead: string[];
		tableRows: string[][];
		children: Snippet;
	}

	let { title, caption, tableHead, tableRows, children }: Props = $props();
	const titleId = `fig-${Math.random().toString(36).slice(2, 9)}`;
</script>

<figure class="figure" aria-labelledby={titleId}>
	<figcaption class="figure__kopf">
		<h2 id={titleId}>{title}</h2>
		<p>{caption}</p>
	</figcaption>

	{@render children()}

	<details class="figure__tabelle">
		<summary>{de.charts.table}</summary>
		{#if tableRows.length === 0}
			<p>{de.charts.empty}</p>
		{:else}
			<div class="scroll">
				<table>
					<thead>
						<tr>
							{#each tableHead as head (head)}
								<th scope="col">{head}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each tableRows as row, i (i)}
							<tr>
								{#each row as cell, j (j)}
									<td>{cell}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</details>
</figure>

<style>
	.figure {
		margin: 0;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.figure__kopf h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	.figure__kopf p {
		margin: 0.2rem 0 0.75rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}
	.figure__tabelle {
		margin-top: 0.75rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}
	.figure__tabelle summary {
		cursor: pointer;
		color: var(--link);
		padding: 0.25rem 0;
	}
	.scroll {
		max-height: 18rem;
		overflow: auto;
		margin-top: 0.5rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		text-align: left;
		padding: 0.3rem 0.5rem;
		border-bottom: 1px solid var(--grid);
		font-variant-numeric: tabular-nums;
	}
	th {
		color: var(--text-primary);
		position: sticky;
		top: 0;
		background: var(--surface-1);
	}
</style>
