import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
const folder = () => resolve(env.ROOMQU_MEDIA_DIR || '.demo/original-media');
export async function saveImage(file: File, owner: string) {
	if (file.size > 2 * 1024 * 1024) error(400, 'Gambar maksimal 2 MB.');
	const bytes = new Uint8Array(await file.arrayBuffer());
	const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
	const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	const webp =
		Buffer.from(bytes.slice(0, 4)).toString() === 'RIFF' &&
		Buffer.from(bytes.slice(8, 12)).toString() === 'WEBP';
	const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
	if (!mime || mime !== file.type) error(400, 'Gunakan gambar PNG, JPEG, atau WebP.');
	const id = randomUUID();
	await mkdir(folder(), { recursive: true });
	await writeFile(resolve(folder(), id + '.bin'), bytes);
	await writeFile(resolve(folder(), id + '.json'), JSON.stringify({ owner, mime }));
	return '/files/' + id;
}
export async function readImage(id: string, owner: string) {
	if (!/^[a-f0-9-]{36}$/.test(id)) error(404, 'Gambar tidak ditemukan.');
	try {
		const meta = JSON.parse(await readFile(resolve(folder(), id + '.json'), 'utf8'));
		if (meta.owner !== owner) error(404, 'Gambar tidak ditemukan.');
		return { mime: meta.mime, bytes: await readFile(resolve(folder(), id + '.bin')) };
	} catch {
		error(404, 'Gambar tidak ditemukan.');
	}
}
