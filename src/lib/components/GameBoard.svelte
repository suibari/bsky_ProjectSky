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

  function endTurn() {
    const success = engine.endTurn();
    if (!success) {
      if (gameState.phase === "main") {
        alert("You must play an Avatar card this turn!");
      }
      return;
    }

    if (gameState.victory) {
      alert("Victory! 10 Billion Points!");
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
    Math.min(100, (gameState.player.buzzPoints / 10_000_000_000) * 100),
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
          {formatScore(gameState.player.buzzPoints)} BP
        </div>
        <div class="text-xs text-slate-500 font-mono">Goal: 10.000G</div>
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
          <div class="flex-grow flex gap-2 items-center overflow-x-auto p-2">
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
              Buzz
            </div>
            <div class="text-2xl font-black text-blue-400 drop-shadow-md">
              {formatScore(
                lane.avatar.buzzPower *
                  lane.contents.reduce(
                    (acc, c, i) => acc * Math.pow(c.buzzFactor, i + 1),
                    1,
                  ),
              )}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Hand (Bottom) -->
  <div
    class="h-80 w-full bg-slate-800/95 border-t border-slate-700 flex flex-col z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0"
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
    <div class="flex-grow flex items-center px-8 gap-8 overflow-x-auto">
      <!-- Avatars -->
      <div class="flex gap-4 pr-8 border-r border-slate-600/50">
        {#each gameState.player.hand.avatars as card, i (card.uuid || card.id)}
          <div
            class="hover:-translate-y-4 transition-transform duration-200 relative z-0"
            in:receive={{ key: card.uuid || card.id }}
            out:send={{ key: card.uuid || card.id }}
            animate:flip
          >
            <Card
              {card}
              interactive={gameState.phase === "main"}
              onClick={() => playAvatar(i)}
            />
          </div>
        {/each}
      </div>

      <!-- Contents -->
      <div class="flex gap-4">
        {#each gameState.player.hand.contents as card, i (card.uuid || card.id)}
          <div
            class="hover:-translate-y-4 transition-transform duration-200 relative z-0"
            in:receive={{ key: card.uuid || card.id }}
            out:send={{ key: card.uuid || card.id }}
            animate:flip
          >
            <Card
              {card}
              interactive={gameState.phase === "main"}
              onClick={() => playContent(i)}
            />
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
        {gameState.victory ? "YOU WENT VIRAL!" : "FADED INTO OBSCURITY"}
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
