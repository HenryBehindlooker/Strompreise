import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const envExample = readFileSync(resolve(import.meta.dirname, '../../.env.example'), 'utf8');

const assignments = envExample
	.split('\n')
	.map((line) => line.trim())
	.filter((line) => line !== '' && !line.startsWith('#'))
	.map((line) => {
		const index = line.indexOf('=');
		return { key: line.slice(0, index), value: line.slice(index + 1) };
	});

describe('.env.example', () => {
	it('dokumentiert die Pflicht-Variablen', () => {
		const keys = assignments.map((a) => a.key);
		expect(keys).toEqual(
			expect.arrayContaining(['DATABASE_PATH', 'JOBS_ENABLED', 'USER_AGENT_CONTACT'])
		);
	});

	it('enthält keine Secret-Namen mit Werten', () => {
		const secretLike = /(SECRET|PRIVATE|TOKEN|PASSWORD|API_KEY)/i;
		const leaking = assignments.filter((a) => secretLike.test(a.key) && a.value !== '');
		expect(leaking).toEqual([]);
	});
});
