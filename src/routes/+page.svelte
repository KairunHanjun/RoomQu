<script lang="ts">
	import Login from '$lib/demo/Login.svelte';
	import './demo/demo.css';
	let { form } = $props();
</script>

<div class="rq-demo rq-mobile-shell"><Login {form} /></div>
