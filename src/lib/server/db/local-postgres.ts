import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hash } from 'argon2';

export async function initializeLocalPostgres(pg: PGlite) {
	await pg.waitReady;
	const exists = await pg.query<{ name: string | null }>(
		"SELECT to_regclass('public.accounts')::text AS name"
	);
	if (!exists.rows[0]?.name) {
		const sql = await readFile(resolve('drizzle/0000_original-schema.sql'), 'utf8');
		await pg.exec(sql);
	}
	if ((await pg.query('SELECT id FROM accounts LIMIT 1')).rows.length) return;
	const password = await hash('DemoRoom123!', { memoryCost: 19456, timeCost: 2, parallelism: 1 });
	await pg.transaction(async (tx) => {
		for (const [id, username, role] of [
			['original-host', 'host.demo', 'H'],
			['original-fo', 'front.demo', 'FO'],
			['original-hk', 'clean.demo', 'HK'],
			['original-tech', 'tech.demo', 'T'],
			['other-host', 'other.host', 'H'],
			['other-fo', 'other.front', 'FO']
		]) {
			await tx.query(
				'INSERT INTO accounts(id,account_type,username,password_hash,email,created_by_who) VALUES($1,$2,$3,$4,$5,$6)',
				[
					id,
					role,
					username,
					password,
					username + '@example.test',
					username.startsWith('other.') ? 'other.host' : 'host.demo'
				]
			);
		}
		for (const [id, name, owner] of [
			['agent-walkin', 'Walk-in', 'host.demo'],
			['agent-urban', 'Urban Stay', 'host.demo'],
			['agent-other', 'Other agency', 'other.host']
		])
			await tx.query('INSERT INTO agents(id,agent_name,email,created_by_who) VALUES($1,$2,$3,$4)', [
				id,
				name,
				id + '@example.test',
				owner
			]);
		for (let i = 1; i <= 8; i++)
			await tx.query('INSERT INTO units(id,name,unit_state,created_by_who) VALUES($1,$2,$3,$4)', [
				'original-unit-' + i,
				String(100 + i),
				i === 1 ? 'Working' : i === 5 ? 'StandBy' : i === 8 ? 'Closed' : 'Ready',
				'host.demo'
			]);
		await tx.query(
			"INSERT INTO units(id,name,unit_state,created_by_who) VALUES('other-unit','OTHER-101','Ready','other.host')"
		);
		await tx.query(
			`INSERT INTO customers(uuid,host_name,agent,unit_id,name,duration,from_time,to_time,price,komisi,"isDurationDays") VALUES('original-guest','host.demo','agent-urban','original-unit-1','Alya (Demo)',2,NOW(),NOW()+INTERVAL '2 days',560000,56000,true)`
		);
		await tx.query(
			`INSERT INTO masalah(id,unit_id,who,type,img_url,description,berat) VALUES('original-issue','original-unit-8','front.demo','FO','/demo/issue.svg','Lampu ruangan perlu diganti (dummy)',true)`
		);
	});
}
