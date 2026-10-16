<script lang="ts">
	import Dashboard from '$lib/demo/Dashboard.svelte';
	let { data, form } = $props();
</script>

<Dashboard snapshot={data.snapshot} view={data.view} result={form} integrated={true} />
