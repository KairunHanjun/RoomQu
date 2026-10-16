<script lang="ts">
	let { name = 'grid', size = 20 }: { name?: string; size?: number } = $props();
	const paths: Record<string, string> = {
		grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
		room: 'M3 21h18 M5 21V3h14v18 M14 12h1',
		users:
			'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
		clean: 'm16 3 5 5-8 8-5-5z M8 11l-5 5 5 5 5-5 M5 18l3-3',
		issue: 'm12 3 10 18H2z M12 9v5 M12 17v1',
		clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
		agent: 'M3 7h18v14H3z M8 7V3h8v4 M3 12h18',
		arrow: 'M5 12h14 M13 6l6 6-6 6',
		check: 'm5 12 4 4L19 6',
		logout: 'M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4',
		download: 'M12 3v12 M7 10l5 5 5-5 M3 17v4h18v-4',
		plus: 'M12 4v16 M4 12h16'
	};
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path d={paths[name] || paths.grid} /></svg
>
