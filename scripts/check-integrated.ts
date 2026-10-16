import assert from 'node:assert/strict';
const base = process.env.ROOMQU_TEST_URL || 'http://127.0.0.1:1232';
let count = 0;
async function request(
	path: string,
	status: number,
	cookie = '',
	data?: Record<string, string>,
	origin = base
) {
	const response = await fetch(base + path, {
		redirect: 'manual',
		method: data ? 'POST' : 'GET',
		headers: {
			Accept: 'text/html',
			...(cookie ? { Cookie: cookie } : {}),
			...(data ? { Origin: origin } : {})
		},
		...(data ? { body: new URLSearchParams(data) } : {})
	});
	const text = await response.text();
	assert.equal(
		response.status,
		status,
		`${path}: expected ${status}, got ${response.status}: ${text.slice(0, 300)}`
	);
	count++;
	return { response, text };
}
async function login(username: string) {
	const { response } = await request('/', 302, '', { username, password: 'DemoRoom123!' });
	assert.ok(response.headers.get('set-cookie')?.startsWith('auth-session='));
	return response.headers.get('set-cookie')!.split(';')[0];
}
const action = (role: string, cookie: string, data: Record<string, string>, status = 200) =>
	request('/User/' + role + '?/integrated', status, cookie, data);
const home = await request('/', 200);
assert.equal(home.response.headers.get('x-roomqu-backend'), 'original-drizzle');
await request('/User/H', 302);
await request('/', 400, '', { username: 'host.demo', password: 'wrong' });
const host = await login('host.demo'),
	front = await login('front.demo'),
	hk = await login('clean.demo'),
	tech = await login('tech.demo');
for (const [role, cookie] of [
	['H', host],
	['FO', front],
	['HK', hk],
	['T', tech]
])
	await request('/User/' + role, 200, cookie);
await request('/User/H', 302, front);
await request('/User/FO?view=staff', 403, front);
await request(
	'/User/H?/integrated',
	403,
	host,
	{ intent: 'unit', name: 'CSRF-UNIT' },
	'https://example.invalid'
);
await action('H', host, { intent: 'checkin' }, 403);
await action('FO', front, { intent: 'checkin', unitId: 'other-unit' }, 404);
await action(
	'FO',
	front,
	{
		intent: 'checkin',
		unitId: 'original-unit-2',
		agentId: 'agent-walkin',
		guestName: 'Integration Guest (Demo)',
		nights: '2',
		price: 'invalid',
		komisi: '0'
	},
	400
);
const booking = await action('FO', front, {
	intent: 'checkin',
	unitId: 'original-unit-2',
	agentId: 'agent-walkin',
	guestName: 'Integration Guest (Demo)',
	nights: '2',
	price: '600000',
	komisi: '45000'
});
assert.ok(booking.text.includes('customers dan units asli'));
const bookings = await request('/User/H?view=bookings', 200, host);
assert.ok(bookings.text.includes('Integration Guest (Demo)'));
assert.ok(bookings.text.includes('600.000'));
assert.ok(bookings.text.includes('45.000'));
await action('FO', front, { intent: 'checkin', unitId: 'original-unit-2' }, 409);
await action('FO', front, { intent: 'checkout', unitId: 'original-unit-2' });
await action('HK', hk, { intent: 'cleaning', unitId: 'original-unit-2' });
await action('HK', hk, { intent: 'cleaning', unitId: 'original-unit-2' }, 409);
const cleaning = await request('/User/H?view=cleaning', 200, host);
const id = cleaning.text.match(/name="id"\s+value="([^"]+)"/);
assert.ok(id, 'Host approval form must expose a real kebersihan identifier');
await action('HK', hk, { intent: 'approve', id: id[1] }, 403);
await action('H', host, { intent: 'approve', id: id[1] });
const cleaned = await request('/User/H?view=cleaning', 200, host);
assert.ok(!cleaned.text.includes('Menunggu persetujuan</h3>'));
await action(
	'FO',
	front,
	{ intent: 'issue', unitId: 'other-unit', description: 'Wrong property' },
	404
);
await action('T', tech, { intent: 'resolve', id: 'original-issue' });
const issue = await request('/User/T?view=issues', 200, tech);
assert.ok(issue.text.includes('Selesai'));
await action('HK', hk, { intent: 'attendance' });
await action('HK', hk, { intent: 'attendance' }, 409);
await action('FO', front, {
	intent: 'checkin',
	unitId: 'original-unit-3',
	agentId: 'agent-walkin',
	guestName: 'Hourly Guest (Demo)',
	nights: '3',
	durationUnit: 'hours',
	price: '150000',
	komisi: '10000'
});
const hourly = await request('/User/FO?view=bookings', 200, front);
assert.ok(hourly.text.includes('3 jam'));
const hourlyUnits = await request('/User/FO?view=units', 200, front);
assert.ok(
	hourlyUnits.text.includes('>Hourly Guest (Demo)</strong>'),
	'Hourly booking must stay occupied until its actual expiry'
);
await action('FO', front, { intent: 'checkout', unitId: 'original-unit-3' });
const upload = new FormData();
upload.set('intent', 'cleaning');
upload.set('unitId', 'original-unit-5');
upload.set(
	'roomImage',
	new File(
		[
			Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXkAAAAASUVORK5CYII=',
				'base64'
			)
		],
		'dummy.png',
		{ type: 'image/png' }
	)
);
const uploaded = await fetch(base + '/User/HK?/integrated', {
	method: 'POST',
	headers: { Origin: base, Cookie: hk, Accept: 'text/html' },
	body: upload
});
assert.equal(uploaded.status, 200);
count++;
const evidence = await request('/User/H?view=cleaning', 200, host);
const imagePath = evidence.text.match(/src="(\/files\/[a-f0-9-]+)"/);
assert.ok(imagePath, 'Uploaded image must use authenticated local storage');
const picture = await request(imagePath[1], 200, host);
assert.equal(picture.response.headers.get('content-type'), 'image/png');
const otherHost = await login('other.host');
await request(imagePath[1], 404, otherHost);
await request(imagePath[1], 302);
const username = 'integration_' + Date.now().toString().slice(-8);
await action('H', host, {
	intent: 'staff',
	username,
	password: 'DemoRoom123!',
	email: username + '@example.test',
	role: 'FO'
});
await login(username);
await action('H', host, {
	intent: 'agent',
	name: 'Integration Agent ' + username,
	email: username + '.agent@example.test'
});
await action('H', host, { intent: 'unit', name: 'INT-' + username.slice(-8) });
const excel = await fetch(base + '/export/bookings', {
	headers: { Cookie: host },
	redirect: 'manual'
});
assert.equal(excel.status, 200);
assert.ok(excel.headers.get('content-type')?.includes('spreadsheetml'));
assert.ok((await excel.arrayBuffer()).byteLength > 1000);
count++;
await request('/export/bookings', 403, front);
await request('/demo/host', 404, host);
await request('/api/upload_pic', 403, front);
await request('/logout', 303, front, {});
await request('/User/FO', 302, front);
console.log(
	`Integrated original backend: ${count} HTTP assertions passed. Dummy records were created; use a fresh database directory for repeatable runs.`
);
