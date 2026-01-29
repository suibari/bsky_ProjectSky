<script lang="ts">
  import { onMount, tick } from "svelte";
  import { GameEngine } from "../game/engine";
  import type { GameState, Card } from "../game/types";
  import CardComponent from "./Card.svelte";
  import gsap from "gsap";
  import { crossfade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { flip } from "svelte/animate";
  import { formatScore } from "$lib/utils/format";
  import AnimatedNumber from "$lib/components/AnimatedNumber.svelte";
  import { t } from "$lib/i18n";
  import SettingsModal from "./SettingsModal.svelte";
  import ScoreAnimation from "$lib/components/visuals/ScoreAnimation.svelte";
  import TurnTransition from "$lib/components/visuals/TurnTransition.svelte";
  //   import GameClear from "$lib/components/visuals/GameClear.svelte";

  /* Temporarily disabling visual components to focus on core logic wire-up first, will re-enable after checking them */

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
    avatarDeck: any[];
    contentDeck: any[];
  }>();

  // Svelte 5 Reactivity
  let gameState = $state<GameState>(
    GameEngine.createInitialState(did, handle, avatarDeck, contentDeck),
  );

  const engine = new GameEngine(gameState);

  // UI State
  let selectedCardIndex = $state<number | null>(null);
  let showSettings = $state(false);
  let showScoreCalculation = $state(false);
  let showTurnTransition = $state(false);
  let animationLanes = $state<{ card: any }[]>([]);

  // Actions
  function startGame() {
    startTurn();
  }

  function startTurn() {
    showTurnTransition = true;
    engine.startTurn();
  }

  function handleTurnTransitionComplete() {
    showTurnTransition = false;
  }

  function playCard(index: number) {
    // Only if affordable
    const card = gameState.player.hand[index];
    if (gameState.player.pdsCurrent >= card.cost) {
      engine.playCard(index);
      selectedCardIndex = null;
    } else {
      // Visualize error
      const el = document.getElementById(`hand-card-${index}`);
      if (el) {
        gsap.to(el, { x: 5, duration: 0.1, yoyo: true, repeat: 3 });
      }
    }
  }

  function pdsBoost() {
    if (gameState.player.pdsCurrent >= 3) {
      engine.pdsBoost();
    } else {
      // Visualize error (shake PDS meter maybe? for now just skip)
    }
  }

  function endTurn() {
    // Show animation first

    // Prepare animation data
    const lanesForAnimation = gameState.player.field.map((l) => ({
      card: l.card,
    }));

    // If no field cards, skip animation or just show "0"
    if (gameState.turnCount >= 15) {
      // Game end transition?
    }

    animationLanes = lanesForAnimation;
    // We want to show what we *will* get.
    // Actually ScoreAnimation adds to a total?
    // The previous one took "previousTotal".
    // In new logic, we just generate +X score. We don't necessarily animate the "Total Score" climbing from A to B inside the modal,
    // unless we want to.

    // Let's pass the *current* score as "previousTotal" just for visual context if needed,
    // but the new ScoreAnimation mostly focuses on the +Gain.

    showScoreCalculation = true;
  }

  function handleScoreAnimationComplete() {
    showScoreCalculation = false;
    engine.endTurn();
    if (!gameState.gameOver) {
      startTurn();
    }
  }

  // Computed
  let progressPercent = $derived(
    Math.min(100, (gameState.player.buzzPoints / 100_000_000) * 100),
  );
</script>

<div
  class="h-full w-full bg-slate-900 text-white flex flex-col overflow-hidden relative"
>
  {#if showTurnTransition}
    <TurnTransition
      turn={gameState.turnCount}
      onComplete={handleTurnTransitionComplete}
    />
  {/if}

  {#if gameState.turnCount === 0}
    <div
      class="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"
    >
      <button
        class="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl rounded-full shadow-[0_0_50px_rgba(37,99,235,0.5)] transition-all hover:scale-110 active:scale-95 animate-pulse"
        onclick={startGame}
      >
        START GAME
      </button>
    </div>
  {/if}

  <!-- HUD -->
  <div
    class="w-full flex flex-col md:flex-row bg-slate-800 border-b border-slate-700 z-20 shrink-0 relative pt-[env(safe-area-inset-top)]"
  >
    <!-- Progress Bar -->
    <div class="absolute bottom-0 left-0 w-full h-1 bg-slate-700">
      <div
        class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
        style="width: {progressPercent}%"
      ></div>
    </div>

    <div
      class="grid grid-cols-[1fr_auto_auto] md:flex md:items-center md:justify-between px-2 py-2 md:px-8 gap-2 w-full"
    >
      <div class="flex items-center gap-4 col-span-1">
        <h1
          class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500"
        >
          {$t("turn")}
          {gameState.turnCount}/15
        </h1>
        <div class="flex flex-col gap-1">
          <div
            class="flex flex-col text-[10px] md:text-xs uppercase tracking-widest text-slate-400 font-bold leading-tight"
          >
            <span>{gameState.phase} Phase</span>
            <span class="text-yellow-400 whitespace-nowrap">
              Multiplier: x{gameState.phaseMultiplier}
            </span>
          </div>
        </div>
      </div>

      <!-- Center: Score & PDS -->
      <div
        class="flex flex-col items-center justify-center md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-auto"
      >
        <!-- PDS Meter -->
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-bold text-slate-400">PDS LOAD</span>
          <div class="flex gap-0.5">
            {#each Array(gameState.player.pdsCapacity) as _, i}
              <div
                class="w-2 h-4 rounded-sm {i < gameState.player.pdsCurrent
                  ? 'bg-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.8)]'
                  : 'bg-slate-700'} transition-all"
              ></div>
            {/each}
          </div>
          <span class="text-xs font-mono text-pink-400"
            >{gameState.player.pdsCurrent}/{gameState.player.pdsCapacity}</span
          >
        </div>

        <div
          class="text-xl md:text-3xl font-black tabular-nums text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        >
          <AnimatedNumber value={gameState.player.buzzPoints} />
          <span class="text-sm md:text-xl">{$t("users")}</span>
        </div>
      </div>

      <!-- Settings -->
      <div class="flex justify-end col-span-1 md:w-auto">
        <button
          class="p-2 text-slate-400 hover:text-white transition-colors bg-slate-800/50 rounded-full backdrop-blur-md"
          onclick={() => (showSettings = true)}
          aria-label={$t("settings")}
        >
          ⚙️
        </button>
      </div>
    </div>
  </div>

  <!-- Main Game Area -->
  <div class="flex-grow flex relative overflow-hidden">
    <!-- Field -->
    <div
      class="flex-grow relative overflow-y-auto p-2 md:p-8 flex flex-col gap-4 items-center bg-slate-900/50 pb-32"
    >
      {#if gameState.player.field.length === 0}
        <div class="text-slate-600 font-bold text-2xl mt-20">
          No Active Users on Field
        </div>
      {/if}

      {#each gameState.player.field as lane (lane.id)}
        <div
          class="w-full max-w-2xl bg-slate-800/80 rounded-2xl border border-slate-700 p-4 flex gap-4 relative items-center"
          in:receive={{ key: lane.card.uuid }}
          out:send={{ key: lane.card.uuid }}
          animate:flip
        >
          <!-- Card Mini View -->
          <div class="scale-50 origin-left -ml-6 -my-10">
            <CardComponent card={lane.card} interactive={false} />
          </div>

          <!-- Info -->
          <div class="flex flex-col">
            <div class="text-lg font-bold text-white">
              {lane.card.displayName || lane.card.handle}
            </div>
            <div class="text-sm text-slate-400">
              {lane.card.description || "Active User"}
            </div>
            <div class="mt-2 text-blue-400 font-bold flex gap-2">
              <span
                >Generating +{lane.card.power * gameState.phaseMultiplier} Users/Turn</span
              >
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Hand (Bottom) -->
  <div
    class="h-64 md:h-80 w-full bg-slate-800/95 border-t border-slate-700 flex flex-col z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 overflow-y-hidden pb-[env(safe-area-inset-bottom)]"
  >
    <div
      class="h-8 bg-black/20 flex items-center px-4 text-xs font-bold text-slate-400 gap-8"
    >
      <span>Hand: {gameState.player.hand.length}</span>
      <span>Deck: {gameState.player.deck.length}</span>
      <span>Discard: {gameState.player.discard.length}</span>
    </div>

    <div
      class="flex-grow flex items-center justify-center gap-4 px-8 overflow-x-auto overflow-y-hidden pb-4"
    >
      {#each gameState.player.hand as card, i (card.uuid)}
        <div
          id="hand-card-{i}"
          class="relative transition-all duration-300 z-0 hover:z-10 group"
          style="transform: translateY({selectedCardIndex === i
            ? '-20px'
            : '0px'})"
        >
          <div
            class="scale-90 hover:scale-100 transition-transform origin-bottom"
          >
            <CardComponent
              {card}
              interactive={gameState.phase === "main"}
              onClick={() => playCard(i)}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Game Over Overlay -->
  {#if gameState.gameOver}
    <div
      class="absolute inset-0 bg-black/90 z-50 flex items-center justify-center flex-col gap-4"
    >
      <h1
        class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500"
      >
        FINISH
      </h1>
      <div class="text-4xl text-white font-bold">
        Rank: <span class="text-yellow-400 text-6xl">{gameState.finalRank}</span
        >
      </div>
      <div class="text-2xl text-slate-400">
        Score: {formatScore(gameState.player.buzzPoints)}
      </div>
      <button
        class="mt-8 px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105"
        onclick={() => location.reload()}
      >
        Play Again
      </button>
    </div>
  {/if}

  <!-- PDS Boost Button -->
  <button
    class="absolute bottom-8 right-48 z-40 p-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg shadow-xl hover:scale-105 transition-all border-2 border-pink-400/50 disabled:opacity-50 disabled:grayscale flex flex-col items-center leading-tight"
    style="right: 180px;"
    onclick={pdsBoost}
    disabled={gameState.gameOver ||
      gameState.phase !== "main" ||
      gameState.player.pdsCurrent < 3}
  >
    <span class="text-sm">DRAW 1</span>
    <span class="text-xs opacity-80">(Cost: 3)</span>
  </button>

  <!-- Turn Button -->
  <button
    class="absolute bottom-6 right-6 z-40 w-32 h-16 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-2xl hover:scale-110 transition-all border-4 border-blue-400/50 disabled:opacity-50 disabled:grayscale"
    onclick={gameState.phase === "draw" ? startTurn : endTurn}
    disabled={gameState.gameOver}
  >
    {gameState.turnCount === 0
      ? "START"
      : gameState.phase === "draw"
        ? "DRAW"
        : "END TURN"}
  </button>

  <SettingsModal
    isOpen={showSettings}
    onClose={() => (showSettings = false)}
    {did}
    {handle}
  />

  {#if showScoreCalculation}
    <ScoreAnimation
      lanes={animationLanes}
      phaseMultiplier={gameState.phaseMultiplier}
      onComplete={handleScoreAnimationComplete}
    />
  {/if}
</div>
