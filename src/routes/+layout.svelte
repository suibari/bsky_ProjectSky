<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";

	let { children } = $props();

	onMount(async () => {
		// Init handled in +page.svelte
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.png" />
	<meta property="og:title" content="Project Sky -Road to 100M-" />
	<meta property="og:description" content="A Bluesky Card Game" />
	<meta property="og:image" content="/ogp.png" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>
{@render children()}
