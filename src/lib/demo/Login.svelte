<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/demo/Icon.svelte';
	let { form }: { form?: { error?: string } | null } = $props();
	let username = $state('');
	let password = $state('');
	const accounts = [
		['Host', 'host.demo'],
		['Front Office', 'front.demo'],
		['House Keeping', 'clean.demo'],
		['Teknisi', 'tech.demo']
	];
	function useAccount(value: string) {
		username = value;
		password = 'DemoRoom123!';
	}
</script>

<svelte:head
	><title>Masuk · RoomQu</title><meta
		name="description"
		content="Demo lokal RoomQu untuk pengelolaan unit, tamu, kebersihan, dan perawatan."
	/></svelte:head
>
<main class="rq-login">
	<section class="rq-login-story">
		<a href="/" class="rq-brand"
			><span class="rq-brand-mark">RQ</span><span
				>Room<span class="rq-brand-accent">Qu</span><small>PROPERTY OPERATIONS</small></span
			></a
		>
		<div>
			<p class="rq-eyebrow">SATU RUANG KERJA, EMPAT PERAN</p>
			<h1>Operasional tertata.<br />Tim bergerak bersama.</h1>
			<p>Pantau unit, sambut tamu, dan koordinasikan kebersihan serta perawatan dalam satu alur.</p>
			<div class="rq-flow">
				<span>01<em>Front Office</em><strong>Tamu masuk & keluar</strong></span><span
					>02<em>House Keeping</em><strong>Kebersihan terdokumentasi</strong></span
				><span>03<em>Teknisi & Host</em><strong>Perawatan & persetujuan</strong></span>
			</div>
		</div>
		<p class="rq-demo-label">● PORTFOLIO DEMO · DATA SEPENUHNYA FIKTIF</p>
	</section>
	<section class="rq-login-card">
		<p class="rq-eyebrow">SELAMAT DATANG DI ROOMQU</p>
		<h2>Masuk ke ruang kerja.</h2>
		<p class="rq-muted">Pilih akun demo atau gunakan akun staf yang dibuat Host.</p>
		{#if form?.error}<p class="rq-feedback error" role="alert">{form.error}</p>{/if}
		<form method="post" use:enhance>
			<label
				>Username<input
					name="username"
					bind:value={username}
					autocomplete="username"
					required
					placeholder="Masukkan username"
					maxlength="30"
				/></label
			><label
				>Kata sandi<input
					name="password"
					bind:value={password}
					type="password"
					autocomplete="current-password"
					required
					placeholder="Masukkan kata sandi"
				/></label
			><button class="rq-button primary full" type="submit"
				>Masuk ke dashboard <Icon name="arrow" size={17} /></button
			>
		</form>
		<div class="rq-demo-accounts">
			<p>COBA AKUN DEMO</p>
			<div>
				{#each accounts as [label, value]}<button type="button" onclick={() => useAccount(value)}
						>{label}</button
					>{/each}
			</div>
			<small
				>Klik peran untuk mengisi akun contoh.<br />Kata sandi semua akun:
				<code>DemoRoom123!</code></small
			>
		</div>
		<p class="rq-login-foot">
			Demo lokal · Tanpa layanan eksternal<br />Data tersimpan sampai demo direset.
		</p>
	</section>
</main>
