import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('.demo', { recursive: true });
const dir = mkdtempSync(resolve('.demo/integration-test-'));
const port = Number(process.env.ROOMQU_TEST_PORT || 1251);
const base = `http://127.0.0.1:${port}`;
const child = spawn(
	process.execPath,
	[
		'node_modules/vite/bin/vite.js',
		'dev',
		'--host',
		'127.0.0.1',
		'--port',
		String(port),
		'--strictPort'
	],
	{
		cwd: process.cwd(),
		env: {
			...process.env,
			ROOMQU_MODE: 'integrated',
			ROOMQU_PG_DIR: resolve(dir, 'postgres'),
			ROOMQU_MEDIA_DIR: resolve(dir, 'media')
		},
		windowsHide: true,
		stdio: ['ignore', 'pipe', 'pipe']
	}
);
let output = '';
child.stdout.on('data', (d) => {
	output += d;
});
child.stderr.on('data', (d) => {
	output += d;
});
try {
	let ready = false;
	for (let i = 0; i < 90; i++) {
		if (child.exitCode !== null) throw new Error('Test server exited: ' + output);
		try {
			const r = await fetch(base + '/', { signal: AbortSignal.timeout(1000) });
			if (r.status === 200) {
				ready = true;
				break;
			}
		} catch {}
		await new Promise((r) => setTimeout(r, 250));
	}
	if (!ready) throw new Error('Test server unavailable: ' + output);
	process.env.ROOMQU_TEST_URL = base;
	await import('./check-integrated.ts');
} catch (e) {
	console.error(output.slice(-6000));
	throw e;
} finally {
	child.kill();
}
