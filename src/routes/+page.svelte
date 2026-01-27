<script lang="ts">
  import { onMount } from "svelte";
  import { getClient, publicAgent, signIn } from "$lib/atproto"; // Import getClient instead of getAgent
  import { fetchGameDecks, type ProgressKey } from "$lib/game/api";
  import type { AvatarCard, ContentCard } from "$lib/game/types";
  import GameBoard from "$lib/components/GameBoard.svelte";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import { t, locale } from "$lib/i18n";
  import { Agent } from "@atproto/api"; // Class

  let agent = $state<Agent | null>(null);
  let loadingMessageKey = $state<ProgressKey | "loading" | null>("loading");
  let error = $state<string | null>(null);

  // Game Data
  let avatarDeck = $state<AvatarCard[]>([]);
  let contentDeck = $state<ContentCard[]>([]);
  let readyToPlay = $state(false);
  let userDid = $state("");
  let userHandle = $state("");
  let showSettings = $state(false);

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
      error = $t("errorAuth");
    } finally {
      loadingMessageKey = null;
    }
  });

  async function loadDecks(did: string) {
    loadingMessageKey = "loadingLikes";
    try {
      const { avatarDeck: avatars, contentDeck: contents } =
        await fetchGameDecks(agent!, did, (key) => {
          loadingMessageKey = key;
        });

      if (avatars.length < 10 || contents.length < 10) {
        if (avatars.length === 0) error = $t("errorFollowees");
        if (contents.length === 0) error = $t("errorLikes");
      }

      avatarDeck = avatars;
      contentDeck = contents;
      readyToPlay = true;
    } catch (e) {
      console.error(e);
      error = $t("errorData");
    } finally {
      loadingMessageKey = null;
    }
  }

  function handleLogin() {
    const handle = prompt("Enter your Bluesky handle (e.g. user.bsky.social):");
    if (handle) {
      signIn(handle);
    }
  }
</script>

<svelte:head>
  <title>{$t("titleMain")} {$t("titleSub")}</title>
</svelte:head>

<div
  class="h-dvh w-full bg-slate-950 text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col overflow-hidden"
>
  {#if loadingMessageKey}
    <div
      class="flex-grow w-full flex items-center justify-center flex-col gap-4"
    >
      <div
        class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"
      ></div>
      <p class="text-blue-400 font-bold animate-pulse">
        {$t(loadingMessageKey)}
      </p>
    </div>
  {:else if readyToPlay && agent}
    <GameBoard did={userDid} handle={userHandle} {avatarDeck} {contentDeck} />
  {:else}
    <!-- Landing / Login -->
    <div
      class="flex-grow w-full flex flex-col items-center justify-center relative overflow-hidden"
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

      <!-- Settings Button (Top Right) -->
      <!-- Language Switcher (Top Right) -->
      <div class="absolute top-4 right-4 z-50 flex gap-2">
        <button
          class="px-3 py-1 rounded-full font-bold text-sm transition-all {$locale ===
          'jp'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-slate-800/50 text-slate-400 hover:text-white backdrop-blur-md'}"
          onclick={() => locale.set("jp")}
        >
          JP
        </button>
        <button
          class="px-3 py-1 rounded-full font-bold text-sm transition-all {$locale ===
          'en'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-slate-800/50 text-slate-400 hover:text-white backdrop-blur-md'}"
          onclick={() => locale.set("en")}
        >
          EN
        </button>
      </div>

      <div
        class="z-10 text-center flex flex-col items-center gap-8 max-w-2xl px-4"
      >
        <div class="mb-4">
          <div class="flex flex-col items-center">
            <h1
              class="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-white drop-shadow-2xl leading-tight"
            >
              {$t("titleMain")}
            </h1>
            <h2
              class="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-slate-200 drop-shadow-lg mt-2"
            >
              {$t("titleSub")}
            </h2>
          </div>
          <p
            class="text-slate-400 text-lg md:text-xl mt-4 max-w-lg mx-auto leading-relaxed"
          >
            {$t("subtitle")}
          </p>
        </div>

        {#if error}
          <div
            class="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200"
          >
            {error}
            <button class="ml-4 underline" onclick={() => location.reload()}
              >{$t("retry")}</button
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
            {$t("signIn")}
          </button>
          <p class="text-slate-600 text-sm">
            {$t("signInNote")}
          </p>
        {:else}
          <!-- Handled in Settings -->
        {/if}
      </div>
    </div>
  {/if}

  <SettingsModal
    isOpen={showSettings}
    onClose={() => (showSettings = false)}
    did={userDid}
    handle={userHandle}
  />
</div>
