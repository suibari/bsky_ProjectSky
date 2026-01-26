<script lang="ts">
  import { onMount } from "svelte";
  import { getClient, publicAgent, signIn, signOut } from "$lib/atproto"; // Import getClient instead of getAgent
  import { fetchAvatarDeck, fetchContentDeck } from "$lib/game/api";
  import type { AvatarCard, ContentCard } from "$lib/game/types";
  import GameBoard from "$lib/components/GameBoard.svelte";
  import { Agent } from "@atproto/api"; // Class

  let agent = $state<Agent | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Game Data
  let avatarDeck = $state<AvatarCard[]>([]);
  let contentDeck = $state<ContentCard[]>([]);
  let readyToPlay = $state(false);
  let userDid = $state("");
  let userHandle = $state("");

  onMount(async () => {
    try {
      const client = getClient();
      if (!client) throw new Error("OAuth client not initialized");

      const result = await client.init();
      if (result) {
        agent = new Agent(result.session);

        userDid = result.session.did;

        // @ts-ignore
        userHandle = (result.handle || result.sub || "") as string; // Handle might be in result?

        // Ensure we have the handle properly if not in result
        // if userHandle is effectively just the DID or empty, fetch profile
        if (!userHandle || !userHandle.includes(".")) {
          // Fetch profile to get handle?
          try {
            const profile = await publicAgent.getProfile({ actor: userDid });
            userHandle = profile.data.handle;
          } catch (e) {
            console.warn("Could not fetch profile handle", e);
          }
        }

        await loadDecks(userDid);
      }
    } catch (e) {
      console.error("Auth Error:", e);
      error = "Authentication failed. Please try signing in again.";
    } finally {
      loading = false;
    }
  });

  async function loadDecks(did: string) {
    loading = true;
    try {
      const [avatars, contents] = await Promise.all([
        fetchAvatarDeck(did),
        fetchContentDeck(agent!, did),
      ]);

      if (avatars.length < 10 || contents.length < 10) {
        if (avatars.length === 0)
          error = "No followees found. Follow some people!";
        if (contents.length === 0) error = "No likes found. Like some posts!";
      }

      avatarDeck = avatars;
      contentDeck = contents;
      readyToPlay = true;
    } catch (e) {
      console.error(e);
      error = "Failed to load game data";
    } finally {
      loading = false;
    }
  }

  function handleLogin() {
    const handle = prompt("Enter your Bluesky handle (e.g. user.bsky.social):");
    if (handle) {
      signIn(handle);
    }
  }
</script>

<div
  class="min-h-screen bg-slate-950 text-white font-sans selection:bg-blue-500 selection:text-white"
>
  {#if loading}
    <div class="flex items-center justify-center h-screen flex-col gap-4">
      <div
        class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
      ></div>
      <p class="text-blue-400 font-bold animate-pulse">
        Loading AT Battlers...
      </p>
    </div>
  {:else if readyToPlay && agent}
    <GameBoard did={userDid} handle={userHandle} {avatarDeck} {contentDeck} />
  {:else}
    <!-- Landing / Login -->
    <div
      class="flex flex-col items-center justify-center h-screen relative overflow-hidden"
    >
      <!-- Background Decoration -->
      <div
        class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black z-0"
      ></div>
      <div
        class="absolute top-10 left-10 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse"
      ></div>
      <div
        class="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000"
      ></div>

      <div
        class="z-10 text-center flex flex-col items-center gap-8 max-w-2xl px-4"
      >
        <div class="mb-4">
          <h1
            class="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-white drop-shadow-2xl"
          >
            AT Battlers
          </h1>
          <p
            class="text-slate-400 text-xl mt-4 max-w-lg mx-auto leading-relaxed"
          >
            The Single-Player SNS Card Game.<br />
            Battle with your graph. Go viral.
          </p>
        </div>

        {#if error}
          <div
            class="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200"
          >
            {error}
            <button class="ml-4 underline" onclick={() => location.reload()}
              >Retry</button
            >
          </div>
        {/if}

        {#if !agent}
          <button
            class="px-10 py-4 bg-white text-black text-lg font-bold rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all active:scale-95 flex items-center gap-2"
            onclick={handleLogin}
          >
            <svg viewBox="0 0 24 24" class="w-6 h-6 fill-blue-600"
              ><path
                d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99z"
              /></svg
            >
            Sign in with Bluesky
          </button>
          <p class="text-slate-600 text-sm">
            Requires a Bluesky account. OAuth 2.0 Secure Login.
          </p>
        {:else}
          <button
            class="px-8 py-3 bg-slate-800 border border-slate-700 hover:border-blue-500 hover:text-blue-400 rounded-lg transition"
            onclick={() => signOut(userDid).then(() => location.reload())}
          >
            Sign Out @{userHandle}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
