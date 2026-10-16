<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · RoomQu</title></svelte:head>
<main
	style="min-height:100vh;display:grid;place-content:center;background:#f5f7fb;color:#20283f;font-family:Arial,sans-serif;padding:32px;text-align:center"
>
	<p>ROOMQU · DEMO PORTOFOLIO</p>
	<h1>{page.status}</h1>
	<p>{page.error?.message || 'Halaman tidak dapat dibuka.'}</p>
	<a href="/">Kembali ke RoomQu</a>
</main>
