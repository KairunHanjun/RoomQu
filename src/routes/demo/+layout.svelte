<script lang="ts">
	import './demo.css';
	let { children } = $props();
</script>

<svelte:head><meta name="robots" content="noindex,nofollow" /></svelte:head>
<div class="rq-demo">{@render children()}</div>
