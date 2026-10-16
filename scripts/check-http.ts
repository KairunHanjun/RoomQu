// Standalone SQLite prototype only: ROOMQU_MODE=demo, port 1233.
import assert from 'node:assert/strict';
const base = process.env.ROOMQU_TEST_URL || 'http://127.0.0.1:1233';
let count = 0;
async function expectStatus(path: string, status: number, init: RequestInit = {}) {
	const response = await fetch(base + path, {
		...init,
		redirect: 'manual',
		headers: { Accept: 'text/html', ...init.headers }
	});
	assert.equal(response.status, status, `${path}: expected ${status}, got ${response.status}`);
	count++;
	return response;
}
async function login(username: string) {
	const response = await expectStatus('/demo/login', 303, {
		method: 'POST',
		headers: { Origin: base },
		body: new URLSearchParams({ username, password: 'DemoRoom123!' })
	});
	return response.headers.get('set-cookie')!.split(';')[0];
}
await expectStatus('/', 303);
await expectStatus('/demo/host', 303);
await expectStatus('/demo/login', 200);
const host = await login('host.demo');
const front = await login('front.demo');
const hk = await login('clean.demo');
const tech = await login('tech.demo');
for (const [area, cookie] of [
	['host', host],
	['front-office', front],
	['housekeeping', hk],
	['technician', tech]
]) {
	const response = await expectStatus('/demo/' + area, 200, { headers: { Cookie: cookie } });
	assert.ok((await response.text()).includes('Urban Residence'));
}
await expectStatus('/demo/host', 403, { headers: { Cookie: front } });
await expectStatus('/demo/front-office?view=staff', 403, { headers: { Cookie: front } });
await expectStatus('/demo/host', 403, {
	method: 'POST',
	headers: { Cookie: host, Origin: 'https://example.invalid' },
	body: new URLSearchParams({ intent: 'unit', name: 'HTTP999', type: 'Studio', rate: '280000' })
});
await expectStatus('/demo/front-office', 403, {
	method: 'POST',
	headers: { Cookie: front, Origin: base },
	body: new URLSearchParams({ intent: 'unit', name: 'HTTP999', type: 'Studio', rate: '280000' })
});
await expectStatus('/api/upload_pic', 403, {
	method: 'POST',
	headers: { Cookie: front, Origin: base },
	body: new FormData()
});
const exportFile = await expectStatus('/demo/export/bookings', 200, { headers: { Cookie: host } });
assert.ok(exportFile.headers.get('content-type')?.includes('spreadsheetml'));
assert.ok((await exportFile.arrayBuffer()).byteLength > 1000);
await expectStatus('/demo/export/bookings', 403, { headers: { Cookie: front } });
await expectStatus('/demo/export/unknown', 404, { headers: { Cookie: host } });
await expectStatus('/demo/front-office?view=attendance', 200, {
	method: 'POST',
	headers: { Cookie: front, Origin: base },
	body: new URLSearchParams({ intent: 'attendance' })
});
await expectStatus('/demo/front-office?view=attendance', 400, {
	method: 'POST',
	headers: { Cookie: front, Origin: base },
	body: new URLSearchParams({ intent: 'attendance' })
});
await expectStatus('/demo/logout', 405, { headers: { Cookie: front } });
await expectStatus('/demo/logout', 303, {
	method: 'POST',
	headers: { Cookie: front, Origin: base },
	body: new URLSearchParams()
});
await expectStatus('/demo/front-office', 303, { headers: { Cookie: front } });
console.log(`HTTP checks passed: ${count}. This run adds one dummy attendance record.`);
