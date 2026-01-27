<script lang="ts">
  import { onMount } from "svelte";
  import { GameEngine } from "../game/engine";
  import type { GameState, AvatarCard, ContentCard } from "../game/types";
  import Card from "./Card.svelte";
  import gsap from "gsap";
  import { crossfade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { flip } from "svelte/animate";

  const [send, receive] = crossfade({
    duration: (d) => Math.sqrt(d * 200),
    fallback(node, params) {
      const style = getComputedStyle(node);
      const transform = style.transform === "none" ? "" : style.transform;

      return {
        duration: 600,
        easing: quintOut,
        css: (t) => `
          transform: ${transform} scale(${t});
          opacity: ${t}
        `,
      };
    },
  });

  let { did, handle, avatarDeck, contentDeck } = $props<{
    did: string;
    handle: string;
    avatarDeck: AvatarCard[];
    contentDeck: ContentCard[];
  }>();

  // Svelte 5 Reactivity
  let gameState = $state<GameState>(
    GameEngine.createInitialState(did, handle, avatarDeck, contentDeck),
  );

  const engine = new GameEngine(gameState);

  // Actions
  function startTurn() {
    engine.startTurn();
  }

  function playAvatar(index: number) {
    engine.playAvatar(index);
  }

  function playContent(cardIndex: number) {
    engine.playContent(cardIndex);
  }

  function returnAvatar(laneIndex: number) {
    engine.returnAvatar(laneIndex);
  }

  function returnContent(laneIndex: number, contentIndex: number) {
    engine.returnContent(laneIndex, contentIndex);
  }

  function releaseAvatar(index: number) {
    engine.releaseAvatar(index);
    avatarSelection = null; // Close menu
  }

  function releaseContent(index: number) {
    engine.releaseContent(index);
    contentSelection = null;
  }

  // UI State for Avatar Menu
  let avatarSelection = $state<number | null>(null);
  // UI State for Content Menu
  let contentSelection = $state<number | null>(null);

  function handleAvatarClick(index: number) {
    if (gameState.phase !== "main") return;
    if (avatarSelection === index) {
      avatarSelection = null; // Toggle off
    } else {
      avatarSelection = index;
      contentSelection = null; // Close other
    }
  }

  function handleContentClick(index: number) {
    if (gameState.phase !== "main") return;
    if (contentSelection === index) {
      contentSelection = null;
    } else {
      contentSelection = index;
      avatarSelection = null;
    }
  }

  function confirmPlayAvatar(index: number) {
    playAvatar(index);
    avatarSelection = null;
  }

  function confirmReleaseAvatar(index: number) {
    releaseAvatar(index);
  }

  function confirmPlayContent(index: number) {
    playContent(index);
    contentSelection = null;
  }

  function confirmReleaseContent(index: number) {
    releaseContent(index);
  }

  // Helper for Score Preview (Mirrors Engine Logic)
  function calculateLaneScore(
    lane: (typeof gameState.player.field)[0],
  ): number {
    const avatarPower = lane.avatar.buzzPower;
    const tagCounts: Record<string, number> = {};
    lane.contents.forEach((c) => {
      c.metadata?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    let contentSum = 1;

    lane.contents.forEach((content) => {
      let cardScore = content.buzzFactor;

      // Metadata Bonus (x2)
      if (content.metadata?.some((tag) => tagCounts[tag] > 1)) {
        cardScore *= 2;
      }

      // Account Match Bonus (^2)
      if (content.authorDid && content.authorDid === lane.avatar.id) {
        cardScore = Math.pow(cardScore, 2);
      }

      contentSum *= cardScore;
    });

    return avatarPower * contentSum;
  }

  function endTurn() {
    const success = engine.endTurn();
    if (!success) {
      if (gameState.phase === "main") {
        alert("You must play an Avatar card this turn!");
      }
      return;
    }

    if (gameState.victory) {
      alert("Victory! 100 Million Users!");
    } else if (gameState.gameOver) {
      alert("Game Over! Deck Empty.");
    }
  }

  function formatScore(score: number): string {
    if (score < 1000) return score.toString();

    const suffixes = ["K", "M", "G", "T"];
    const suffixNum = Math.floor(("" + Math.floor(score)).length / 3);

    // Handle case for exactly 1000, 1000000 etc where length/3 might align such that we need index-1
    // Actually easier logic:
    if (score >= 1_000_000_000) return (score / 1_000_000_000).toFixed(3) + "G";
    if (score >= 1_000_000) return (score / 1_000_000).toFixed(3) + "M";
    if (score >= 1_000) return (score / 1_000).toFixed(3) + "K";

    return score.toString();
  }

  // Progress to 10G
  let progressPercent = $derived(
    Math.min(100, (gameState.player.buzzPoints / 100_000_000) * 100),
  );

  let currentSlotLimit = $derived(
    gameState.player.turnCount >= 7
      ? 3
      : gameState.player.turnCount >= 4
        ? 2
        : 1,
  );
</script>

<div
  class="h-screen w-full bg-slate-900 text-white flex flex-col overflow-hidden relative"
>
  <!-- HUD -->
  <div
    class="h-20 w-full flex flex-col bg-slate-800 border-b border-slate-700 z-20 shrink-0 relative"
  >
    <!-- Progress Bar Background -->
    <div class="absolute bottom-0 left-0 w-full h-1 bg-slate-700">
      <div
        class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
        style="width: {progressPercent}%"
      ></div>
    </div>

    <div class="flex-grow flex items-center justify-between px-8">
      <div class="flex items-center gap-4">
        <h1
          class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500"
        >
          Turn {gameState.player.turnCount}
        </h1>
        <div
          class="flex flex-col text-xs uppercase tracking-widest text-slate-400 font-bold"
        >
          <span>{gameState.phase} Phase</span>
          <span class="text-blue-400">
            Level {Math.ceil(gameState.player.turnCount / 3)} (Max {gameState
              .player.turnCount >= 7
              ? 3
              : gameState.player.turnCount >= 4
                ? 2
                : 1} Slots)
          </span>
        </div>
      </div>

      <div class="flex flex-col items-end">
        <div
          class="text-3xl font-black tabular-nums text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        >
          {formatScore(gameState.player.buzzPoints)} Users
        </div>
        <div class="text-xs text-slate-500 font-mono">Goal: 100M Users</div>
      </div>

      <button
        class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-bold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={gameState.phase === "draw" || gameState.phase === "end"
          ? startTurn
          : endTurn}
        disabled={gameState.gameOver || gameState.victory}
      >
        {gameState.phase === "draw" || gameState.phase === "end"
          ? "Start Next Turn"
          : "End Turn"}
      </button>
    </div>
  </div>

  <!-- Main Game Area -->
  <div class="flex-grow flex relative overflow-hidden">
    <!-- Field (Timeline) -->
    <div
      class="flex-grow relative overflow-y-auto p-8 flex flex-col gap-6 items-center bg-slate-900/50 pb-32"
    >
      {#if gameState.player.field.length === 0}
        <div class="text-slate-600 font-bold text-2xl mt-20">
          Timeline Empty. Play an Avatar!
        </div>
      {/if}

      {#each gameState.player.field as lane, index (lane.id)}
        <!-- Lane -->
        <div
          class="w-full max-w-4xl bg-slate-800/80 rounded-2xl border border-slate-700 p-4 flex gap-4 transition-colors hover:border-blue-500/50 relative"
        >
          <!-- Avatar Slot -->
          <!-- Interactive if created this turn (can return to hand) -->
          <!-- Avatar Slot -->
          <!-- Interactive if created this turn (can return to hand) -->
          <div
            class="shrink-0 scale-75 origin-top-left -mr-8"
            in:receive={{ key: lane.avatar.uuid || lane.avatar.id }}
            out:send={{ key: lane.avatar.uuid || lane.avatar.id }}
          >
            <Card
              card={lane.avatar}
              interactive={gameState.phase === "main" &&
                lane.turnCreated === gameState.player.turnCount}
              onClick={() => returnAvatar(index)}
            />
          </div>

          <!-- Content Slots -->
          <div
            class="flex-grow flex gap-2 items-center overflow-x-auto overflow-y-hidden p-2"
          >
            {#each lane.contents as content, cIndex (content.uuid || content.id)}
              <div
                class="shrink-0 scale-75 origin-left"
                in:receive={{ key: content.uuid || content.id }}
                out:send={{ key: content.uuid || content.id }}
                animate:flip
              >
                <Card
                  card={content}
                  interactive={gameState.phase === "main" &&
                    lane.turnCreated === gameState.player.turnCount}
                  onClick={() => returnContent(index, cIndex)}
                />
              </div>
            {/each}

            <!-- Empty slots indicators -->
            {#if lane.contents.length < currentSlotLimit}
              <div
                class="w-32 h-48 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center opacity-30 text-xs"
              >
                Slot
              </div>
            {/if}
          </div>

          <!-- Lane Score Display -->
          <div
            class="absolute bottom-4 right-4 text-right z-10 pointer-events-none"
          >
            <div
              class="text-xs text-slate-400 font-bold uppercase tracking-wider"
            >
              Users
            </div>
            <div class="text-2xl font-black text-blue-400 drop-shadow-md">
              {formatScore(calculateLaneScore(lane))}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Hand (Bottom) -->
  <div
    class="h-96 w-full bg-slate-800/95 border-t border-slate-700 flex flex-col z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 overflow-y-hidden"
  >
    <div
      class="h-8 bg-black/20 flex items-center px-4 text-xs font-bold text-slate-400 gap-8"
    >
      <span>Hand</span>
      <span
        >Avatars: {gameState.player.hand.avatars.length} / Deck: {gameState
          .player.deck.avatars.length}</span
      >
      <span
        >Content: {gameState.player.hand.contents.length} / Deck: {gameState
          .player.deck.contents.length}</span
      >
    </div>
    <div
      class="flex-grow flex items-end px-8 gap-8 overflow-x-auto overflow-y-hidden pb-4 pt-20"
    >
      <!-- Avatars -->
      <div class="flex gap-4 pr-8 border-r border-slate-600/50 relative">
        {#each gameState.player.hand.avatars as card, i (card.uuid || card.id)}
          <!-- Avatar Card Container -->
          <div
            class="relative transition-transform duration-200 z-0 flex flex-col gap-2 items-center group"
            in:receive={{ key: card.uuid || card.id }}
            out:send={{ key: card.uuid || card.id }}
            animate:flip
          >
            <!-- Card Itself -->
            <div
              class="{avatarSelection === i
                ? '-translate-y-8 scale-105 z-10'
                : 'group-hover:-translate-y-4'} transition-all duration-300"
            >
              <Card
                {card}
                interactive={gameState.phase === "main"}
                onClick={() => handleAvatarClick(i)}
              />
            </div>

            <!-- Action Menu (Visible if selected) -->
            <!-- Action Menu (Bottom Vertical) -->
            {#if avatarSelection === i}
              <div
                class="absolute bottom-12 left-1/2 -translate-x-1/2 w-40 z-50 flex flex-col items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto"
                role="group"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
              >
                <button
                  class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-base font-bold rounded-xl shadow-xl hover:scale-105 transition-all border-2 border-blue-400"
                  onclick={(e) => {
                    e.stopPropagation();
                    confirmPlayAvatar(i);
                  }}
                >
                  OPEN
                </button>
                <button
                  class="w-3/4 py-1.5 bg-red-900/80 hover:bg-red-800 text-red-100 text-[10px] font-bold rounded-lg shadow-md hover:scale-105 transition-all border border-red-500/50 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={gameState.player.hand.avatars.length <= 1}
                  onclick={(e) => {
                    e.stopPropagation();
                    confirmReleaseAvatar(i);
                  }}
                >
                  RELEASE
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Contents -->
      <div class="flex gap-4">
        {#each gameState.player.hand.contents as card, i (card.uuid || card.id)}
          <!-- Content Card Container -->
          <div
            class="relative transition-transform duration-200 z-0 flex flex-col gap-2 items-center group"
            in:receive={{ key: card.uuid || card.id }}
            out:send={{ key: card.uuid || card.id }}
            animate:flip
          >
            <!-- Card Itself -->
            <div
              class="{contentSelection === i
                ? '-translate-y-8 scale-105 z-10'
                : 'group-hover:-translate-y-4'} transition-all duration-300"
            >
              <Card
                {card}
                interactive={gameState.phase === "main"}
                onClick={() => handleContentClick(i)}
              />
            </div>

            <!-- Action Menu (Bottom Vertical) -->
            {#if contentSelection === i}
              <div
                class="absolute bottom-12 left-1/2 -translate-x-1/2 w-40 z-50 flex flex-col items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto"
                role="group"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
              >
                <button
                  class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-base font-bold rounded-xl shadow-xl hover:scale-105 transition-all border-2 border-blue-400"
                  onclick={(e) => {
                    e.stopPropagation();
                    confirmPlayContent(i);
                  }}
                >
                  OPEN
                </button>
                <button
                  class="w-3/4 py-1.5 bg-red-900/80 hover:bg-red-800 text-red-100 text-[10px] font-bold rounded-lg shadow-md hover:scale-105 transition-all border border-red-500/50 uppercase tracking-wider"
                  onclick={(e) => {
                    e.stopPropagation();
                    confirmReleaseContent(i);
                  }}
                >
                  RELEASE
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Victory/Loss Overlay -->
  {#if gameState.victory || gameState.gameOver}
    <div
      class="absolute inset-0 bg-black/80 z-50 flex items-center justify-center flex-col gap-4 backdrop-blur-sm"
    >
      <h1
        class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 to-red-600"
      >
        {gameState.victory ? "YOU ENLIVENED BLUESKY!" : "FADED INTO OBSCURITY"}
      </h1>
      <p class="text-2xl text-white font-bold">
        Final Score: {gameState.player.buzzPoints.toLocaleString()}
      </p>
      <button
        class="mt-8 px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-110 transition"
        onclick={() => location.reload()}
      >
        Play Again
      </button>
    </div>
  {/if}
</div>
