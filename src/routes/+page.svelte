<script lang="ts">
  import { onMount } from "svelte";
  import { publicAgent, getPdsEndpoint } from "$lib/atproto";
  import { fetchGameDecks, type ProgressKey } from "$lib/game/api";
  import type { UserCard, PostCard } from "$lib/game/types";
  import GameBoard from "$lib/components/GameBoard.svelte";
  import InfoModal from "$lib/components/visuals/InfoModal.svelte";

  import { t, locale } from "$lib/i18n";
  import { Agent } from "@atproto/api";

  let agent = $state<Agent | null>(null);
  let loadingMessageKey = $state<ProgressKey | "loading" | null>(null); // Start null
  let error = $state<string | null>(null);

  // Game Data
  let avatarDeck = $state<UserCard[]>([]);
  let contentDeck = $state<PostCard[]>([]);
  let readyToPlay = $state(false);
  let showInfoModal = $state(false);
  let userDid = $state("");
  let userHandle = $state("");

  // Input & Typeahead
  let inputText = $state("");
  let suggestions = $state<any[]>([]);
  let showSuggestions = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout>;

  onMount(async () => {
    // Check localStorage
    const savedHandle = localStorage.getItem("bsky_handle");
    if (savedHandle) {
      inputText = savedHandle;
      // Optionally auto-start or just pre-fill
    }
  });

  function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    inputText = value;
    clearTimeout(debounceTimer);

    if (!value || value.length < 3) {
      suggestions = [];
      showSuggestions = false;
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await publicAgent.searchActorsTypeahead({
          q: value,
          limit: 5,
        });
        suggestions = res.data.actors;
        showSuggestions = true;
      } catch (e) {
        console.warn("Typeahead error", e);
      }
    }, 300);
  }

  async function selectHandle(handle: string, did?: string) {
    inputText = handle;
    showSuggestions = false;

    // Resolve DID if not provided
    if (!did) {
      try {
        const res = await publicAgent.resolveHandle({ handle });
        did = res.data.did;
      } catch (e) {
        error = $t("errorAuth"); // Reuse auth error or generic
        return;
      }
    }

    // Save to localStorage
    localStorage.setItem("bsky_handle", handle);

    // Start Game
    await startGame(handle, did!);
  }

  async function startGame(handle: string, did: string) {
    userHandle = handle;
    userDid = did;
    agent = publicAgent; // Use public agent for game queries

    loadingMessageKey = "loadingLikes";
    error = null;

    try {
      await loadDecks(did);
    } catch (e) {
      console.error(e);
      error = $t("errorData");
    }
  }

  async function loadDecks(did: string) {
    loadingMessageKey = "loadingLikes";
    // Reset decks
    avatarDeck = [];
    contentDeck = [];

    try {
      const { avatarDeck: avatars, contentDeck: contents } =
        await fetchGameDecks(publicAgent, did, (key) => {
          loadingMessageKey = key;
        });

      if (avatars.length < 10 || contents.length < 10) {
        if (avatars.length === 0) error = $t("errorFollowees");
        if (contents.length === 0) error = $t("errorLikes");
      }

      // If we got some data but maybe not enough, still try to play if configured to allow partials?
      // For now strict check as before, but maybe looser logging.

      if (!error) {
        avatarDeck = avatars;
        contentDeck = contents;
        readyToPlay = true;
      }
    } catch (e) {
      console.error(e);
      error = $t("errorData");
    } finally {
      loadingMessageKey = null;
    }
  }
</script>

<svelte:head>
  <title>{$t("titleMain")} {$t("titleSub")}</title>
</svelte:head>

<div
  class="h-dvh w-full bg-slate-950 text-white font-sans selection:bg-blue-500 selection:text-white flex flex-col {readyToPlay
    ? 'overflow-hidden'
    : 'overflow-y-auto'}"
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
  {:else if readyToPlay}
    <GameBoard
      did={userDid}
      handle={userHandle}
      {avatarDeck}
      {contentDeck}
      onOpenInfo={() => (showInfoModal = true)}
    />
  {:else}
    <!-- Landing / Handle Input -->
    <div
      class="flex-grow w-full flex flex-col items-center justify-center relative"
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
        class="z-10 text-center flex flex-col items-center gap-8 max-w-2xl px-4 w-full"
      >
        <div class="mb-4">
          <div class="flex flex-col items-center">
            <h1
              class="text-5xl md:text-6xl font-title text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-white drop-shadow-2xl leading-tight"
            >
              {$t("titleMain")}
            </h1>
            <h2
              class="text-2xl md:text-4xl font-title text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-slate-200 drop-shadow-lg mt-2"
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

        <!-- Handle Input Section -->
        <div class="w-full max-w-md relative flex flex-col gap-4">
          <!-- Game Description Button -->
          <div class="flex justify-center">
            <button
              class="text-blue-300 hover:text-white underline text-sm flex items-center gap-1 transition-colors"
              onclick={() => (showInfoModal = true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="w-4 h-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              {$t("manual.title")}
            </button>
          </div>

          <div class="relative w-full">
            <input
              type="text"
              class="w-full px-6 py-4 bg-slate-900/80 border border-slate-700 rounded-full text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xl backdrop-blur-sm"
              placeholder="Enter Bluesky Handle (e.g. user.bsky.social)"
              value={inputText}
              oninput={handleInput}
              onfocus={() => {
                if (inputText.length >= 3) showSuggestions = true;
              }}
            />
            <!-- Search Icon -->
            <div
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          <!-- Typeahead Dropdown -->
          {#if showSuggestions && suggestions.length > 0}
            <div
              class="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl z-50"
            >
              {#each suggestions as actor}
                <button
                  class="w-full px-4 py-3 text-left hover:bg-slate-800 flex items-center gap-3 transition-colors border-b border-slate-800 last:border-0"
                  onclick={() => selectHandle(actor.handle, actor.did)}
                >
                  {#if actor.avatar}
                    <img
                      src={actor.avatar}
                      alt={actor.handle}
                      class="w-10 h-10 rounded-full bg-slate-800 object-cover"
                    />
                  {:else}
                    <div
                      class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500"
                    >
                      ?
                    </div>
                  {/if}
                  <div class="flex flex-col">
                    <span class="font-bold text-white leading-none"
                      >{actor.displayName || actor.handle}</span
                    >
                    <span class="text-sm text-slate-400">@{actor.handle}</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <button
          class="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold rounded-full transition-all shadow-lg hover:shadow-blue-500/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          onclick={() => selectHandle(inputText)}
          disabled={!inputText}
        >
          Start Game
        </button>

        <!-- Language Switcher -->
        <div class="flex gap-2 mt-4">
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
      </div>
    </div>
  {/if}

  {#if showInfoModal}
    <InfoModal onClose={() => (showInfoModal = false)} />
  {/if}
</div>
