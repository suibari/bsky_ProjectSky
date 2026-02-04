<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";

	let { children } = $props();

	const isProd = import.meta.env.PROD;

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

	{#if isProd}
		<!-- Google tag (gtag.js) -->
		<script
			async
			src="https://www.googletagmanager.com/gtag/js?id=G-G2Z5BK2R9P"
		></script>
		<script>
			window.dataLayer = window.dataLayer || [];
			function gtag() {
				dataLayer.push(arguments);
			}
			gtag("js", new Date());

			gtag("config", "G-G2Z5BK2R9P");
		</script>
	{/if}
</svelte:head>
{@render children()}
