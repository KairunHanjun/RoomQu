import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		enhancedImages(),
		...(process.env.ROOMQU_MODE === 'live'
			? [
					SvelteKitPWA({
						manifest: {
							name: 'RoomQu',
							short_name: 'RQ',
							start_url: '/',
							display: 'standalone',
							background_color: '#141517',
							icons: [
								{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
								{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
							]
						}
					})
				]
			: [])
	],
	server: { host: '127.0.0.1', port: 1231, strictPort: true },
	preview: { host: '127.0.0.1', port: 1231, strictPort: true }
});
