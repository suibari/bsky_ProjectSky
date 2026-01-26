<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import { getClient } from "$lib/atproto";
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();

	onMount(async () => {
		// Init handled in +page.svelte
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
