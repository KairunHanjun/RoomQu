<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Snapshot, Role, Unit } from '$lib/server/demo/store';
	import Icon from './Icon.svelte';
	import { roles, areas, stateLabels, money, dateTime } from './shared';
	let {
		snapshot,
		view,
		result,
		integrated = false
	}: {
		snapshot: Snapshot;
		view: string;
		integrated?: boolean;
		result?: { success?: boolean; message?: string } | null;
	} = $props();
	const allTabs = [
		{ id: 'overview', label: 'Ringkasan', icon: 'grid' },
		{ id: 'units', label: 'Status unit', icon: 'room' },
		{ id: 'bookings', label: 'Data tamu', icon: 'users' },
		{ id: 'cleaning', label: 'Kebersihan', icon: 'clean' },
		{ id: 'issues', label: 'Laporan masalah', icon: 'issue' },
		{ id: 'attendance', label: 'Absensi', icon: 'clock' },
		{ id: 'staff', label: 'Kelola staf', icon: 'users' },
		{ id: 'agents', label: 'Agen & komisi', icon: 'agent' }
	];
	const allowed: Record<Role, string[]> = {
		H: ['overview', 'units', 'bookings', 'cleaning', 'issues', 'attendance', 'staff', 'agents'],
		FO: ['overview', 'units', 'bookings', 'issues', 'attendance'],
		HK: ['overview', 'units', 'cleaning', 'issues', 'attendance'],
		T: ['overview', 'units', 'issues', 'attendance']
	};
	let user = $derived(snapshot.user);
	let tabs = $derived(allTabs.filter((t) => allowed[user.role].includes(t.id)));
	let title = $derived(allTabs.find((t) => t.id === view)?.label || 'Ringkasan');
	let search = $state('');
	let stateFilter = $state('All');
	let selectedUnit = $state('');
	let durationUnit = $state('days');
	let checkinDialog = $state<HTMLDialogElement>();
	let unitDialog = $state<HTMLDialogElement>();
	let filteredUnits = $derived(
		snapshot.units.filter(
			(u) =>
				(stateFilter === 'All' || u.state === stateFilter) &&
				`${u.name} ${u.type}`.toLowerCase().includes(search.toLowerCase())
		)
	);
	let readyUnits = $derived(snapshot.units.filter((u) => u.state === 'Ready'));
	let cleaningUnits = $derived(
		snapshot.units.filter(
			(u) =>
				u.state === 'StandBy' &&
				!snapshot.cleanings.some((c) => c.unitId === u.id && c.status === 'Pending')
		)
	);
	let occupancy = $derived(
		snapshot.stats.total ? Math.round((snapshot.stats.occupied / snapshot.stats.total) * 100) : 0
	);
	let present = $derived(snapshot.attendance.some((a) => a.day === snapshot.today));
	let metrics = $derived(
		user.role === 'H'
			? [
					{
						label: 'Total unit',
						value: String(snapshot.stats.total),
						note: 'Unit dalam properti',
						icon: 'room'
					},
					{
						label: 'Okupansi saat ini',
						value: occupancy + '%',
						note: snapshot.stats.occupied + ' unit terisi',
						icon: 'users'
					},
					{
						label: 'Nominal tercatat',
						value: money(snapshot.stats.revenue),
						note: 'Seluruh pemesanan demo',
						icon: 'agent'
					},
					{
						label: 'Perlu ditinjau',
						value: String(snapshot.stats.pendingCleaning),
						note: 'Persetujuan kebersihan',
						icon: 'clean'
					}
				]
			: user.role === 'FO'
				? [
						{
							label: 'Siap digunakan',
							value: String(snapshot.stats.ready),
							note: 'Unit tersedia untuk tamu',
							icon: 'room'
						},
						{
							label: 'Sedang terisi',
							value: String(snapshot.stats.occupied),
							note: 'Tamu aktif menginap',
							icon: 'users'
						},
						{
							label: 'Menunggu bersih',
							value: String(snapshot.stats.cleaning),
							note: 'Diteruskan ke House Keeping',
							icon: 'clean'
						},
						{
							label: 'Dalam perawatan',
							value: String(snapshot.stats.closed),
							note: 'Belum dapat digunakan',
							icon: 'issue'
						}
					]
				: user.role === 'HK'
					? [
							{
								label: 'Antrean kebersihan',
								value: String(snapshot.stats.cleaning),
								note: 'Unit menunggu dibersihkan',
								icon: 'clean'
							},
							{
								label: 'Menunggu Host',
								value: String(snapshot.stats.pendingCleaning),
								note: 'Laporan perlu persetujuan',
								icon: 'clock'
							},
							{
								label: 'Sudah siap',
								value: String(snapshot.stats.ready),
								note: 'Unit tersedia',
								icon: 'check'
							},
							{
								label: 'Masalah terbuka',
								value: String(snapshot.stats.openIssues),
								note: 'Koordinasi dengan Teknisi',
								icon: 'issue'
							}
						]
					: [
							{
								label: 'Masalah terbuka',
								value: String(snapshot.stats.openIssues),
								note: 'Laporan belum selesai',
								icon: 'issue'
							},
							{
								label: 'Prioritas tinggi',
								value: String(snapshot.issues.filter((i) => !i.done && i.severe).length),
								note: 'Memengaruhi kesiapan unit',
								icon: 'clock'
							},
							{
								label: 'Unit perawatan',
								value: String(snapshot.stats.closed),
								note: 'Belum dapat digunakan',
								icon: 'room'
							},
							{
								label: 'Sudah selesai',
								value: String(snapshot.issues.filter((i) => i.done).length),
								note: 'Laporan yang diselesaikan',
								icon: 'check'
							}
						]
	);
	function url(tab: string) {
		return integrated ? `/User/${user.role}?view=${tab}` : `/demo/${areas[user.role]}?view=${tab}`;
	}
	function openCheckin(id = '') {
		selectedUnit = id || readyUnits[0]?.id || '';
		checkinDialog?.showModal();
	}
	const modalSubmit: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') {
				checkinDialog?.close();
				unitDialog?.close();
			}
		};
</script>

<svelte:head><title>{title} · {roles[user.role]} · RoomQu</title></svelte:head>
<div class="rq-app">
	<aside class="rq-sidebar">
		<a class="rq-brand" href={url('overview')}
			><span class="rq-brand-mark">RQ</span><span
				>Room<span class="rq-brand-accent">Qu</span><small>PROPERTY OPERATIONS</small></span
			></a
		>
		<div class="rq-property">
			<span class="rq-property-icon"><Icon name="room" /></span>
			<div>
				<strong>{integrated ? 'RoomQu' : 'Urban Residence'}</strong><small
					>Properti contoh · Demo</small
				>
			</div>
			<span>⌄</span>
		</div>
		<p class="rq-nav-label">RUANG KERJA {roles[user.role].toUpperCase()}</p>
		<nav aria-label="Navigasi utama">
			{#each tabs as tab}<a class:active={view === tab.id} href={url(tab.id)}
					><Icon name={tab.icon} size={18} /><span>{tab.label}</span
					>{#if tab.id === 'issues' && snapshot.stats.openIssues}<b>{snapshot.stats.openIssues}</b
						>{/if}{#if tab.id === 'cleaning' && snapshot.stats.pendingCleaning}<b
							>{snapshot.stats.pendingCleaning}</b
						>{/if}</a
				>{/each}
		</nav>
		<div class="rq-sidebar-bottom">
			<div class="rq-demo-note"><span>●</span> MODE DEMO LOKAL<small>Data contoh lokal</small></div>
			<form action={integrated ? '/logout' : '/demo/logout'} method="post">
				<button type="submit"><Icon name="logout" size={17} />Keluar dari akun</button>
			</form>
		</div>
	</aside>
	<div class="rq-workspace">
		<header class="rq-topbar">
			<div>
				<span>{integrated ? 'RoomQu' : 'Urban Residence'}</span><span class="rq-breadcrumb">/</span
				><strong>{title}</strong>
			</div>
			<div>
				<span class="rq-date"
					>{new Intl.DateTimeFormat('id-ID', {
						timeZone: 'Asia/Bangkok',
						day: 'numeric',
						month: 'long',
						year: 'numeric'
					}).format(new Date())}</span
				><span class="rq-role">{roles[user.role]}</span><span class="rq-avatar"
					>{user.name.charAt(0)}</span
				>
			</div>
		</header>
		<main class="rq-content">
			{#if result?.message}<p
					role="status"
					class:error={!result.success}
					class:success={result.success}
					class="rq-feedback"
				>
					{result.message}
				</p>{/if}
			<div class="rq-heading">
				<div>
					<p class="rq-eyebrow">
						{view === 'overview'
							? 'RUANG KERJA OPERASIONAL'
							: integrated
								? 'ROOMQU · DATA DUMMY'
								: 'URBAN RESIDENCE · DATA DEMO'}
					</p>
					<h1>{view === 'overview' ? `Selamat datang, ${user.name.split(' ')[0]}.` : title}</h1>
					<p>
						{view === 'overview'
							? 'Satu pandangan untuk semua aktivitas properti hari ini.'
							: view === 'units'
								? 'Pantau kesiapan unit dan koordinasikan langkah berikutnya.'
								: view === 'bookings'
									? 'Pemesanan dan riwayat tamu dari database dummy lokal.'
									: view === 'cleaning'
										? 'Dokumentasi kebersihan dan persetujuan sebelum unit siap digunakan.'
										: view === 'issues'
											? 'Catat kendala, tindak lanjuti perbaikan, dan pantau penyelesaiannya.'
											: view === 'attendance'
												? 'Catatan kehadiran staf berdasarkan waktu Bangkok (UTC+7).'
												: view === 'staff'
													? 'Kelola akses tim tanpa menghapus riwayat pekerjaan mereka.'
													: 'Agen pemesanan dan persentase komisi yang digunakan saat check-in.'}
					</p>
				</div>
				{#if user.role === 'FO' && (view === 'overview' || view === 'units')}<button
						class="rq-button primary"
						onclick={() => openCheckin()}
						disabled={!readyUnits.length}><Icon name="plus" size={16} />Check-in tamu</button
					>{/if}{#if user.role === 'H' && view === 'units'}<button
						class="rq-button primary"
						onclick={() => unitDialog?.showModal()}
						><Icon name="plus" size={16} />Tambah unit</button
					>{/if}{#if user.role === 'H' && ['bookings', 'issues', 'attendance'].includes(view)}<a
						class="rq-button secondary"
						href={`${integrated ? '/export' : '/demo/export'}/${view}`}
						download><Icon name="download" size={16} />Ekspor Excel</a
					>{/if}
			</div>
			{#if view === 'overview'}<div class="rq-metrics">
					{#each metrics as metric}<article class="rq-metric">
							<div><span>{metric.label}</span><Icon name={metric.icon} size={17} /></div>
							<strong class:money={metric.label === 'Nominal tercatat'}>{metric.value}</strong
							><small>{metric.note}</small>
						</article>{/each}
				</div>
				<div class="rq-overview-grid">
					<section class="rq-card">
						<div class="rq-card-heading">
							<div>
								<h2>Status unit</h2>
								<p>Kesiapan properti saat ini</p>
							</div>
							<a href={url('units')}>Lihat semua <span>↗</span></a>
						</div>
						<div class="rq-overview-rooms">
							{#each snapshot.units as unit}<a class="rq-mini-room {unit.state}" href={url('units')}
									><span>{unit.name}</span><small>{stateLabels[unit.state]}</small></a
								>{/each}
						</div>
						<div class="rq-legend">
							{#each Object.entries(stateLabels) as [key, label]}<span
									><i class={key}></i>{label}</span
								>{/each}
						</div>
					</section>
					<aside class="rq-card rq-activity">
						<p class="rq-eyebrow">PRIORITAS OPERASIONAL</p>
						<h2>Langkah berikutnya.</h2>
						<a href={url(user.role === 'H' || user.role === 'HK' ? 'cleaning' : 'units')}
							><span class="rq-activity-icon"><Icon name="clean" /></span>
							<div>
								<strong>{snapshot.stats.cleaning} unit menunggu bersih</strong><small
									>{snapshot.stats.pendingCleaning} laporan menunggu Host</small
								>
							</div>
							<span>↗</span></a
						><a href={url('issues')}
							><span class="rq-activity-icon amber"><Icon name="issue" /></span>
							<div>
								<strong>{snapshot.stats.openIssues} masalah terbuka</strong><small
									>Perlu tindak lanjut teknisi</small
								>
							</div>
							<span>↗</span></a
						><a href={url(user.role === 'H' ? 'attendance' : 'attendance')}
							><span class="rq-activity-icon green"><Icon name="clock" /></span>
							<div>
								<strong
									>{user.role === 'H'
										? snapshot.stats.present + ' staf hadir hari ini'
										: present
											? 'Absensi sudah tercatat'
											: 'Absensi belum tercatat'}</strong
								><small
									>{user.role === 'H'
										? 'Lihat kehadiran tim'
										: 'Catat kehadiran sebelum bekerja'}</small
								>
							</div>
							<span>↗</span></a
						>
						<div class="rq-workflow-note">
							<strong>Alur kesiapan unit</strong>
							<p>Tamu keluar → House Keeping → Persetujuan Host → Siap digunakan</p>
						</div>
					</aside>
				</div>
				<section class="rq-card rq-overview-bottom">
					<div class="rq-card-heading">
						<div>
							<h2>
								{user.role === 'H' || user.role === 'FO'
									? 'Pemesanan terbaru'
									: user.role === 'HK'
										? 'Laporan kebersihan'
										: 'Laporan yang perlu ditangani'}
							</h2>
							<p>Aktivitas dari data demo</p>
						</div>
						<a
							href={url(
								user.role === 'H' || user.role === 'FO'
									? 'bookings'
									: user.role === 'HK'
										? 'cleaning'
										: 'issues'
							)}>Lihat detail ↗</a
						>
					</div>
					<div class="rq-table-scroll">
						<table>
							<thead
								><tr
									><th>Unit</th><th
										>{user.role === 'H' || user.role === 'FO' ? 'Tamu' : 'Catatan'}</th
									><th>Status</th><th
										>{user.role === 'H' || user.role === 'FO' ? 'Total' : 'Dibuat'}</th
									></tr
								></thead
							><tbody
								>{#if user.role === 'H' || user.role === 'FO'}{#each snapshot.bookings.slice(0, 4) as booking}<tr
											><td><strong>{booking.unitName}</strong></td><td
												>{booking.guestName}<small>{booking.agentName}</small></td
											><td
												><span class="rq-badge" class:blue={booking.status === 'Active'}
													>{booking.status === 'Active' ? 'Menginap' : 'Selesai'}</span
												></td
											><td>{money(booking.amount)}</td></tr
										>{/each}{:else if user.role === 'HK'}{#each snapshot.cleanings.slice(0, 4) as item}<tr
											><td><strong>{item.unitName}</strong></td><td class="rq-wrap">{item.notes}</td
											><td
												><span class="rq-badge" class:amber={item.status === 'Pending'}
													>{item.status === 'Pending'
														? 'Menunggu Host'
														: item.status === 'Approved'
															? 'Disetujui'
															: 'Periksa ulang'}</span
												></td
											><td>{dateTime(item.createdAt)}</td></tr
										>{/each}{:else}{#each snapshot.issues
										.filter((i) => !i.done)
										.slice(0, 4) as item}<tr
											><td><strong>{item.unitName}</strong></td><td class="rq-wrap"
												>{item.description}</td
											><td
												><span class="rq-badge" class:amber={item.severe}
													>{item.severe ? 'Prioritas tinggi' : 'Normal'}</span
												></td
											><td>{dateTime(item.createdAt)}</td></tr
										>{/each}{/if}</tbody
							>
						</table>
					</div>
				</section>{/if}
			{#if view === 'units'}<div class="rq-toolbar">
					<div class="rq-filters">
						{#each ['All', 'Ready', 'Working', 'StandBy', 'Closed'] as key}<button
								class:active={stateFilter === key}
								onclick={() => (stateFilter = key)}
								>{key === 'All'
									? 'Semua unit'
									: stateLabels[key as keyof typeof stateLabels]}</button
							>{/each}
					</div>
					<label class="rq-search"
						><span class="rq-sr-only">Cari unit</span><input
							placeholder="Cari nomor atau tipe unit..."
							bind:value={search}
						/></label
					>
				</div>
				<div class="rq-room-grid">
					{#each filteredUnits as unit}<article class="rq-unit-card">
							<div class="rq-unit-top">
								<span class="rq-unit-number">{unit.name}</span><span class="rq-badge {unit.state}"
									>{stateLabels[unit.state]}</span
								>
							</div>
							<h2>{integrated ? 'Unit properti' : unit.type}</h2>
							{#if !integrated}<p class="rq-rate">{money(unit.rate)} <span>/ malam</span></p>{/if}
							<div class="rq-unit-detail">
								{#if unit.state === 'Working'}<Icon name="users" size={16} />
									<div>
										<strong>{unit.guest || 'Tamu sedang menginap'}</strong><small
											>Perkiraan keluar {unit.checkoutAt ? dateTime(unit.checkoutAt) : '—'}</small
										>
									</div>{:else if unit.state === 'StandBy'}<Icon name="clean" size={16} />
									<div>
										<strong>Perlu pemeriksaan kebersihan</strong><small
											>{snapshot.cleanings.some(
												(c) => c.unitId === unit.id && c.status === 'Pending'
											)
												? 'Menunggu persetujuan Host'
												: 'Siap dikerjakan House Keeping'}</small
										>
									</div>{:else if unit.state === 'Closed'}<Icon name="issue" size={16} />
									<div>
										<strong>Dalam penanganan teknisi</strong><small>Belum tersedia untuk tamu</small
										>
									</div>{:else}<Icon name="check" size={16} />
									<div>
										<strong>Unit tersedia</strong><small>Siap menerima tamu berikutnya</small>
									</div>{/if}
							</div>
							{#if user.role === 'FO' && unit.state === 'Ready'}<button
									class="rq-button secondary full"
									onclick={() => openCheckin(unit.id)}
									>Check-in tamu <Icon name="arrow" size={16} /></button
								>{:else if user.role === 'FO' && unit.state === 'Working'}<form
									action={integrated ? '?/integrated' : undefined}
									method="post"
									use:enhance
								>
									<input type="hidden" name="intent" value="checkout" /><input
										type="hidden"
										name="unitId"
										value={unit.id}
									/><button class="rq-button secondary full" type="submit"
										>Check-out tamu <Icon name="arrow" size={16} /></button
									>
								</form>{:else if user.role === 'HK' && unit.state === 'StandBy'}<a
									class="rq-button secondary full"
									href={url('cleaning')}>Kelola kebersihan <Icon name="arrow" size={16} /></a
								>{:else if user.role === 'T' && unit.state === 'Closed'}<a
									class="rq-button secondary full"
									href={url('issues')}>Lihat laporan <Icon name="arrow" size={16} /></a
								>{/if}
						</article>{:else}<p class="rq-empty">Tidak ada unit yang sesuai pencarian.</p>{/each}
				</div>{/if}
			{#if view === 'bookings'}<section class="rq-card">
					<div class="rq-card-heading">
						<div>
							<h2>Daftar pemesanan</h2>
							<p>{snapshot.bookings.length} pemesanan contoh · seluruh nominal fiktif</p>
						</div>
						<span class="rq-tag">DATA DUMMY</span>
					</div>
					<div class="rq-table-scroll">
						<table>
							<thead
								><tr
									><th>Unit / Tamu</th><th>Agen</th><th>Durasi</th><th>Masuk</th><th>Keluar</th><th
										>Total / Komisi</th
									><th>Status</th></tr
								></thead
							><tbody
								>{#each snapshot.bookings as booking}<tr
										><td><strong>{booking.unitName} · {booking.guestName}</strong></td><td
											>{booking.agentName}</td
										><td>{booking.durationLabel || booking.nights + ' malam'}</td><td
											>{dateTime(booking.checkinAt)}</td
										><td>{dateTime(booking.checkoutAt)}</td><td
											><strong>{money(booking.amount)}</strong><small
												>Komisi {money(booking.commission)}</small
											></td
										><td
											><span class="rq-badge" class:blue={booking.status === 'Active'}
												>{booking.status === 'Active' ? 'Menginap' : 'Selesai'}</span
											></td
										></tr
									>{/each}</tbody
							>
						</table>
					</div>
				</section>{/if}
			{#if view === 'cleaning'}<div class="rq-split">
					<section class="rq-card">
						<div class="rq-card-heading">
							<div>
								<h2>Dokumentasi kebersihan</h2>
								<p>Gambar contoh diberi label ilustrasi demo</p>
							</div>
						</div>
						<div class="rq-report-list">
							{#each snapshot.cleanings as item}<article class="rq-cleaning-item">
									<div class="rq-report-title">
										<div>
											<span class="rq-tag">UNIT {item.unitName}</span>
											<h3>
												{item.status === 'Pending'
													? 'Menunggu persetujuan'
													: item.status === 'Approved'
														? 'Kebersihan disetujui'
														: 'Perlu pemeriksaan ulang'}
											</h3>
										</div>
										<span
											class="rq-badge"
											class:amber={item.status === 'Pending'}
											class:green={item.status === 'Approved'}
											>{item.status === 'Pending'
												? 'Pending'
												: item.status === 'Approved'
													? 'Disetujui'
													: 'Dikembalikan'}</span
										>
									</div>
									<div class="rq-cleaning-images">
										<figure>
											<img src={item.roomImage} alt="Dokumentasi ruangan demo" />
											<figcaption>Ruangan</figcaption>
										</figure>
										<figure>
											<img src={item.bathroomImage} alt="Dokumentasi kamar mandi demo" />
											<figcaption>Kamar mandi</figcaption>
										</figure>
									</div>
									<p>{item.notes}</p>
									<div class="rq-report-meta">
										<span>{item.reporter}</span><span>{dateTime(item.createdAt)}</span>
									</div>
									{#if user.role === 'H' && item.status === 'Pending'}<form
											class="rq-inline-actions"
											method="post"
											use:enhance
										>
											<input type="hidden" name="id" value={item.id} /><button
												class="rq-button primary"
												type="submit"
												name="intent"
												value="approve"><Icon name="check" size={16} />Setujui kebersihan</button
											><button
												class="rq-button secondary"
												type="submit"
												name="intent"
												value="reject">Periksa ulang</button
											>
										</form>{/if}
								</article>{:else}<p class="rq-empty">Belum ada laporan kebersihan.</p>{/each}
						</div>
					</section>
					<aside class="rq-card rq-form-card">
						{#if user.role === 'HK'}<p class="rq-eyebrow">SETELAH UNIT DIBERSIHKAN</p>
							<h2>Kirim laporan.</h2>
							<p class="rq-muted">Host akan meninjau sebelum unit kembali siap.</p>
							<form
								action={integrated ? '?/integrated' : undefined}
								method="post"
								enctype="multipart/form-data"
								use:enhance
							>
								<input type="hidden" name="intent" value="cleaning" /><label
									>Unit yang dibersihkan<select name="unitId" required
										><option value="">Pilih unit</option>{#each cleaningUnits as unit}<option
												value={unit.id}>{unit.name} · {unit.type}</option
											>{/each}</select
									></label
								>{#if !integrated}<label
										>Catatan pemeriksaan<textarea
											name="notes"
											rows="4"
											required
											maxlength="500"
											placeholder="Linen diganti, lantai dan fasilitas diperiksa..."
										></textarea></label
									>{/if}<label
									>Foto ruangan (opsional)<input
										name="roomImage"
										type="file"
										accept="image/png,image/jpeg,image/webp"
									/></label
								><label
									>Foto kamar mandi (opsional)<input
										name="bathroomImage"
										type="file"
										accept="image/png,image/jpeg,image/webp"
									/></label
								>
								<p class="rq-form-note">
									Tanpa unggahan, aplikasi memakai ilustrasi demo lokal. PNG/JPEG/WebP maksimal 2 MB
									per gambar.
								</p>
								<button
									class="rq-button primary full"
									type="submit"
									disabled={!cleaningUnits.length}
									>Kirim ke Host <Icon name="arrow" size={16} /></button
								>
							</form>{:else}<p class="rq-eyebrow">PEMERIKSAAN HOST</p>
							<h2>Pastikan siap, baru terima tamu.</h2>
							<ol class="rq-checklist">
								<li>Periksa dokumentasi ruangan.</li>
								<li>Periksa kebersihan kamar mandi.</li>
								<li>Pastikan masalah berat sudah selesai.</li>
								<li>Setujui agar unit kembali tersedia.</li>
							</ol>
							<div class="rq-workflow-note">
								<strong>{snapshot.stats.pendingCleaning} laporan menunggu</strong>
								<p>Persetujuan memperbarui status unit secara langsung.</p>
							</div>{/if}
					</aside>
				</div>{/if}
			{#if view === 'issues'}<div class="rq-split">
					<section class="rq-card">
						<div class="rq-card-heading">
							<div>
								<h2>Daftar masalah unit</h2>
								<p>{snapshot.stats.openIssues} laporan masih terbuka</p>
							</div>
						</div>
						<div class="rq-report-list">
							{#each snapshot.issues as item}<article class="rq-issue-item">
									<div class="rq-report-title">
										<div>
											<span class="rq-tag">UNIT {item.unitName}</span>
											<h3>{item.severe ? 'Perawatan prioritas' : 'Perawatan rutin'}</h3>
										</div>
										<span
											class="rq-badge"
											class:green={!!item.done}
											class:amber={!item.done && !!item.severe}
											>{item.done ? 'Selesai' : item.severe ? 'Prioritas tinggi' : 'Terbuka'}</span
										>
									</div>
									<p>{item.description}</p>
									<div class="rq-issue-evidence">
										<img src={item.image} alt="Bukti laporan masalah demo" />
										<div>
											<span>DOKUMENTASI LAPORAN</span><strong>{item.reporter}</strong><small
												>{dateTime(item.createdAt)}</small
											>
										</div>
									</div>
									{#if user.role === 'T' && !item.done}<form
											action={integrated ? '?/integrated' : undefined}
											method="post"
											use:enhance
										>
											<input type="hidden" name="intent" value="resolve" /><input
												type="hidden"
												name="id"
												value={item.id}
											/><button class="rq-button secondary full" type="submit"
												>Tandai selesai diperbaiki <Icon name="check" size={16} /></button
											>
										</form>{/if}{#if item.resolvedAt}<small class="rq-muted"
											>Diselesaikan {dateTime(item.resolvedAt)}</small
										>{/if}
								</article>{:else}<p class="rq-empty">Belum ada laporan masalah.</p>{/each}
						</div>
					</section>
					<aside class="rq-card rq-form-card">
						{#if user.role !== 'H'}<p class="rq-eyebrow">KOORDINASI TIM</p>
							<h2>Laporkan kendala.</h2>
							<form
								action={integrated ? '?/integrated' : undefined}
								method="post"
								enctype="multipart/form-data"
								use:enhance
							>
								<input type="hidden" name="intent" value="issue" /><label
									>Unit<select name="unitId" required
										><option value="">Pilih unit</option>{#each snapshot.units as unit}<option
												value={unit.id}>{unit.name} · {unit.type}</option
											>{/each}</select
									></label
								><label
									>Penjelasan masalah<textarea
										name="description"
										required
										rows="4"
										maxlength="500"
										placeholder="Jelaskan kendala pada fasilitas unit..."
									></textarea></label
								><label class="rq-checkbox"
									><input name="severe" type="checkbox" />Masalah berat / unit perlu ditutup</label
								><label
									>Foto bukti (opsional)<input
										name="issueImage"
										type="file"
										accept="image/png,image/jpeg,image/webp"
									/></label
								>
								<p class="rq-form-note">
									Tanpa unggahan, ilustrasi demo lokal digunakan. Masalah berat menutup unit kosong
									sampai diperbaiki.
								</p>
								<button class="rq-button primary full" type="submit"
									>Kirim laporan <Icon name="arrow" size={16} /></button
								>
							</form>{:else}<p class="rq-eyebrow">TINDAK LANJUT PERAWATAN</p>
							<h2>Catatan yang terhubung.</h2>
							<p class="rq-muted">
								Laporan dibuat staf dan diselesaikan Teknisi. Unit yang selesai diperbaiki masih
								perlu pemeriksaan kebersihan.
							</p>
							<div class="rq-workflow-note">
								<strong>{snapshot.stats.closed} unit dalam perawatan</strong>
								<p>Masalah berat tidak dapat dilewati saat check-in atau persetujuan kebersihan.</p>
							</div>{/if}
					</aside>
				</div>{/if}
			{#if view === 'attendance'}<div class="rq-split">
					<section class="rq-card">
						<div class="rq-card-heading">
							<div>
								<h2>{user.role === 'H' ? 'Kehadiran tim' : 'Riwayat kehadiran saya'}</h2>
								<p>Waktu ditampilkan dalam zona Bangkok (UTC+7)</p>
							</div>
						</div>
						<div class="rq-table-scroll">
							<table>
								<thead
									><tr
										><th>Staf</th><th>Peran</th><th>Tanggal</th><th>Waktu</th><th>Dokumentasi</th
										></tr
									></thead
								><tbody
									>{#each snapshot.attendance as item}<tr
											><td><strong>{item.name}</strong></td><td
												><span class="rq-badge">{roles[item.role]}</span></td
											><td>{item.day}</td><td>{dateTime(item.createdAt)}</td><td
												><a class="rq-text-link" href={item.image} target="_blank" rel="noreferrer"
													>Lihat gambar ↗</a
												></td
											></tr
										>{:else}<tr
											><td colspan="5" class="rq-empty">Belum ada catatan kehadiran.</td></tr
										>{/each}</tbody
								>
							</table>
						</div>
					</section>
					<aside class="rq-card rq-form-card">
						<p class="rq-eyebrow">KEHADIRAN HARI INI</p>
						<h2>
							{user.role === 'H'
								? 'Pantau tim Anda.'
								: present
									? 'Sudah tercatat.'
									: 'Mulai hari dengan baik.'}
						</h2>
						<p class="rq-muted">
							{user.role === 'H'
								? snapshot.stats.present + ' staf melakukan absensi hari ini.'
								: present
									? 'Absensi hanya dapat dicatat sekali per hari.'
									: 'Catat kehadiran untuk akun Anda sendiri.'}
						</p>
						{#if user.role !== 'H' && !present}<form
								action={integrated ? '?/integrated' : undefined}
								method="post"
								enctype="multipart/form-data"
								use:enhance
							>
								<input type="hidden" name="intent" value="attendance" /><label
									>Foto absensi (opsional)<input
										name="attendanceImage"
										type="file"
										accept="image/png,image/jpeg,image/webp"
									/></label
								>
								<p class="rq-form-note">
									Gunakan data dummy. Ilustrasi lokal digunakan bila foto tidak diunggah.
								</p>
								<button class="rq-button primary full" type="submit"
									>Catat kehadiran <Icon name="check" size={16} /></button
								>
							</form>{/if}
					</aside>
				</div>{/if}
			{#if view === 'staff'}<div class="rq-split">
					<section class="rq-card">
						<div class="rq-card-heading">
							<div>
								<h2>Tim operasional</h2>
								<p>Akun staf yang berada dalam properti Host ini</p>
							</div>
						</div>
						<div class="rq-table-scroll">
							<table>
								<thead
									><tr><th>Nama / Username</th><th>Peran</th><th>Status</th><th>Aksi</th></tr
									></thead
								><tbody
									>{#each snapshot.staff as staff}<tr
											><td><strong>{staff.name}</strong><small>{staff.username}</small></td><td
												>{roles[staff.role]}</td
											><td
												><span class="rq-badge" class:green={!!staff.active}
													>{staff.active ? 'Aktif' : 'Nonaktif'}</span
												></td
											><td
												>{#if staff.active && !integrated}<form
														action={integrated ? '?/integrated' : undefined}
														method="post"
														use:enhance
													>
														<input type="hidden" name="intent" value="disable" /><input
															type="hidden"
															name="id"
															value={staff.id}
														/><button class="rq-small-button danger" type="submit"
															>Nonaktifkan</button
														>
													</form>{/if}</td
											></tr
										>{/each}</tbody
								>
							</table>
						</div>
					</section>
					<aside class="rq-card rq-form-card">
						<p class="rq-eyebrow">AKSES TIM</p>
						<h2>Tambah staf demo.</h2>
						<form action={integrated ? '?/integrated' : undefined} method="post" use:enhance>
							<input type="hidden" name="intent" value="staff" />{#if !integrated}<label
									>Nama lengkap<input name="name" required maxlength="100" /></label
								>{/if}<label
								>Username<input
									name="username"
									required
									pattern={integrated ? '[a-z0-9_\\-]{3,30}' : '[a-z0-9._\\-]{3,30}'}
									maxlength="30"
								/></label
							><label
								>Peran<select name="role"
									><option value="FO">Front Office</option><option value="HK">House Keeping</option
									><option value="T">Teknisi</option></select
								></label
							><label
								>Email contoh<input
									name="email"
									type="email"
									placeholder="staf@example.test"
									required
									maxlength="150"
								/></label
							><label
								>Kata sandi<input
									name="password"
									type="password"
									required
									minlength="8"
									maxlength="72"
									autocomplete="new-password"
								/></label
							><button class="rq-button primary full" type="submit"
								>Buat akun staf <Icon name="plus" size={16} /></button
							>
						</form>
					</aside>
				</div>{/if}
			{#if view === 'agents'}<div class="rq-split">
					<section class="rq-card">
						<div class="rq-card-heading">
							<div>
								<h2>Agen pemesanan</h2>
								<p>
									{integrated
										? 'Nominal komisi dicatat per pemesanan, sesuai backend asli.'
										: 'Komisi dihitung oleh server dari total pemesanan'}
								</p>
							</div>
						</div>
						<div class="rq-table-scroll">
							<table>
								<thead><tr><th>Agen</th><th>Email contoh</th><th>Komisi</th></tr></thead><tbody
									>{#each snapshot.agents as agent}<tr
											><td><strong>{agent.name}</strong></td><td>{agent.email}</td><td
												><span class="rq-badge blue"
													>{integrated ? 'Per pemesanan' : agent.commission + '%'}</span
												></td
											></tr
										>{/each}</tbody
								>
							</table>
						</div>
					</section>
					<aside class="rq-card rq-form-card">
						<p class="rq-eyebrow">MITRA PEMESANAN</p>
						<h2>Tambah agen demo.</h2>
						<form action={integrated ? '?/integrated' : undefined} method="post" use:enhance>
							<input type="hidden" name="intent" value="agent" /><label
								>Nama agen<input name="name" required maxlength="100" /></label
							><label
								>Email contoh<input
									name="email"
									type="email"
									placeholder="agen@example.test"
									required
									maxlength="150"
								/></label
							>{#if !integrated}<label
									>Komisi (%)<input
										name="commission"
										type="number"
										value="0"
										min="0"
										max="50"
										step="1"
										required
									/></label
								>{/if}<button class="rq-button primary full" type="submit"
								>Tambah agen <Icon name="plus" size={16} /></button
							>
						</form>
					</aside>
				</div>{/if}
			<footer class="rq-footer">
				<span>RoomQu <b>·</b> {integrated ? 'RoomQu' : 'Urban Residence'}</span><span
					>Portofolio demo · Seluruh data bersifat fiktif</span
				>
			</footer>
		</main>
	</div>
</div>
{#if user.role === 'FO'}<dialog bind:this={checkinDialog} class="rq-dialog">
		<div class="rq-dialog-heading">
			<div>
				<p class="rq-eyebrow">FRONT OFFICE</p>
				<h2>Check-in tamu demo</h2>
			</div>
			<button aria-label="Tutup formulir check-in" onclick={() => checkinDialog?.close()}>×</button>
		</div>
		{#if result && !result.success}<p role="alert" class="rq-feedback error">
				{result.message}
			</p>{/if}
		<form action={integrated ? '?/integrated' : undefined} method="post" use:enhance={modalSubmit}>
			<input type="hidden" name="intent" value="checkin" /><label
				>Unit tersedia<select name="unitId" bind:value={selectedUnit} required
					>{#each readyUnits as unit}<option value={unit.id}
							>{unit.name}{integrated
								? ''
								: ' · ' + unit.type + ' · ' + money(unit.rate) + '/malam'}</option
						>{/each}</select
				></label
			><label
				>Nama tamu dummy<input
					name="guestName"
					required
					maxlength="100"
					placeholder="Nama Tamu (Demo)"
				/></label
			>
			<div class="rq-form-grid">
				<label
					>Agen pemesanan<select name="agentId" required
						>{#each snapshot.agents as agent}<option value={agent.id}
								>{agent.name} · {integrated ? 'Per pemesanan' : agent.commission + '%'}</option
							>{/each}</select
					></label
				><label
					>{integrated ? 'Durasi' : 'Durasi (malam)'}<input
						name="nights"
						type="number"
						value="1"
						min="1"
						max={integrated && durationUnit === 'hours' ? 23 : 30}
						step="1"
						required
					/></label
				>
			</div>
			{#if integrated}<label
					>Satuan durasi<select name="durationUnit" bind:value={durationUnit}
						><option value="days">Hari / malam</option><option value="hours">Jam (1–23 jam)</option
						></select
					></label
				>
				<div class="rq-form-grid">
					<label
						>Total harga (Rp)<input
							name="price"
							type="number"
							min="0"
							max="100000000"
							step="1"
							required
						/></label
					><label
						>Nominal komisi (Rp)<input
							name="komisi"
							type="number"
							min="0"
							step="1"
							value="0"
							required
						/></label
					>
				</div>{/if}
			<div class="rq-form-note">
				{integrated
					? 'Total harga dan nominal komisi mengikuti input pemesanan pada backend asli. Gunakan data dummy; tidak ada pembayaran atau KTP nyata.'
					: 'Tarif dihitung dari harga unit oleh server. Tidak ada pembayaran atau data identitas nyata pada demo ini.'}
			</div>
			<button class="rq-button primary full" type="submit"
				>Konfirmasi check-in <Icon name="check" size={16} /></button
			>
		</form>
	</dialog>{/if}
{#if user.role === 'H'}<dialog bind:this={unitDialog} class="rq-dialog">
		<div class="rq-dialog-heading">
			<div>
				<p class="rq-eyebrow">KELOLA PROPERTI</p>
				<h2>Tambah unit demo</h2>
			</div>
			<button aria-label="Tutup formulir unit" onclick={() => unitDialog?.close()}>×</button>
		</div>
		{#if result && !result.success}<p role="alert" class="rq-feedback error">
				{result.message}
			</p>{/if}
		<form action={integrated ? '?/integrated' : undefined} method="post" use:enhance={modalSubmit}>
			<input type="hidden" name="intent" value="unit" /><label
				>Nomor / nama unit<input name="name" required maxlength="20" /></label
			>{#if !integrated}<label
					>Tipe unit<select name="type"
						><option>Studio</option><option>Deluxe</option><option>Family</option></select
					></label
				>{/if}{#if !integrated}<label
					>Tarif per malam<input
						name="rate"
						type="number"
						value="280000"
						min="10000"
						max="5000000"
						step="1"
						required
					/></label
				>{/if}<button class="rq-button primary full" type="submit"
				>Simpan unit <Icon name="check" size={16} /></button
			>
		</form>
	</dialog>{/if}
