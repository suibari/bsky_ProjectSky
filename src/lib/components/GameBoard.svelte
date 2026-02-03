<script lang="ts">
  import { onMount, tick } from "svelte";
  import { GameEngine } from "../game/engine";
  import { GAME_CONFIG } from "../game/config";
  import type { GameState, Card } from "../game/types";
  import CardComponent from "./Card.svelte";
  import gsap from "gsap";
  import { crossfade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { flip } from "svelte/animate";
  import { fly } from "svelte/transition";
  import { formatScore } from "$lib/utils/format";
  import AnimatedNumber from "$lib/components/AnimatedNumber.svelte";
  import { t } from "$lib/i18n";

  import ScoreAnimation from "./visuals/ScoreAnimation.svelte";
  import GameClear from "./visuals/GameClear.svelte";
  import TurnTransition from "./visuals/TurnTransition.svelte";
  import RankUp from "$lib/components/visuals/RankUp.svelte";
  import PlayCardAnimation from "$lib/components/visuals/PlayCardAnimation.svelte";
  import { getRank, getRankProgress } from "$lib/game/ranks";

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

  let { did, handle, displayName, avatarDeck, contentDeck, onOpenInfo } =
    $props<{
      did: string;
      handle: string;
      displayName: string;
      avatarDeck: any[];
      contentDeck: any[];
      onOpenInfo?: () => void;
    }>();

  // Svelte 5 Reactivity
  const initialState = GameEngine.createInitialState(
    did,
    handle,
    displayName,
    avatarDeck,
    contentDeck,
  );
  let gameState = $state<GameState>(initialState);

  const engine = new GameEngine(gameState);

  // UI State
  let selectedCardIndex = $state<number | null>(null);

  let showScoreCalculation = $state(false);
  let showTurnTransition = $state(false);
  let animationLanes = $state<{ card: any }[]>([]);
  let menuPosition = $state<{ x: number; y: number } | null>(null);

  // Rank Animation State
  let currentRank = $state(getRank(gameState.player.buzzPoints));
  let rankUpQueue = $state<string[]>([]);
  let showRankUp = $state(false);
  let displayingRank = $state("");

  // Card Animation State
  let playingCardIndex = $state<number | null>(null);
  let playingCard = $state<Card | null>(null);

  // Watch for Rank Up
  $effect(() => {
    const newRank = getRank(gameState.player.buzzPoints);
    if (newRank !== currentRank) {
      // Logic: If we jumped multiple ranks (e.g. G -> D), newRank is D.
      // We just want to show D.
      // So we simply queue/show the newRank.
      // But we should only show if we play animation.
      // If we are already showing an animation, what do we do?
      // User says "Stopping is fine"? Or "Show the bigger one".
      // If we update `currentRank`, the effect fires.

      // Let's just track the "highest seen rank".
      // If newRank is higher than currentRank (which it should be), trigger animation.
      // We need a way to compare ranks strictly to be safe, or just assume buzzPoints always goes up.
      // Assuming buzzPoints goes up:

      // Prevent G animation on load (currentRank init matches newRank)

      currentRank = newRank;
      rankUpQueue.push(newRank);
    }
  });

  // Process Queue
  $effect(() => {
    if (rankUpQueue.length > 0 && !showRankUp) {
      // Take the latest rank (highest) if multiple in queue?
      // Or just FIFO?
      // User said: "If 2 or more ranks up, play the bigger one".
      // This implies if I go G -> F -> E in one update, I show E.
      // My effect above updates `currentRank` effectively immediately on score change.
      // If score changes big, it calls effect once with new big score => new big rank.
      // So we just get D directly.

      // However, if we process queue slowly, we might have [D, C] ?? No, rank only goes up.
      // Actually if we jump G -> D, queue has [D].
      // If we go G -> F then F -> E quickly?
      // Let's just take the last element of queue and clear queue?
      // No, maybe safer to shift.

      const nextRank = rankUpQueue[rankUpQueue.length - 1]; // Take the latest (highest)
      rankUpQueue = []; // Clear intermediate

      displayingRank = nextRank;
      showRankUp = true;
    }
  });

  function handleRankUpComplete() {
    showRankUp = false;
    // If we were in the middle of ending a turn (waiting for this animation), verify next step
    if (gameState.phase === "end" && !gameState.gameOver) {
      // Check if there are more rank ups?
      // The queue logic above automatically sets showRankUp = true if queue > 0.
      // So if queue is empty (processed all), we can proceed to startTurn.
      // We need to wait for the effect to potentially re-trigger showRankUp?
      // Actually, the effect runs synchronously on state change? No, effect runs after.
      // But we just finished this one. Queue should be empty or handled.

      // Optimization: Wait a tick to ensure no new rank up triggered (though unlikely here)
      // Just proceed.
      if (rankUpQueue.length === 0) {
        startTurn();
      }
    }
  }

  // Actions
  function startGame() {
    startTurn();
  }

  onMount(() => {
    startGame();
  });

  function startTurn() {
    if (showRankUp) return; // Guard clause just in case
    selectedCardIndex = null;
    playingCardIndex = null;
    playingCard = null;
    showTurnTransition = true;
    engine.startTurn();
  }

  function handleTurnTransitionComplete() {
    showTurnTransition = false;
  }

  async function handleCardClick(index: number) {
    if (playingCardIndex !== null) return;

    if (selectedCardIndex === index) {
      selectedCardIndex = null; // Toggle off
      menuPosition = null;
    } else {
      selectedCardIndex = index; // Select

      // Calculate Position
      await tick();
      const el = document.getElementById(`hand-card-${index}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Position above the card
        // Card is transformed up by 40px when selected.
        // rect.top includes the transform? Yes.
        // We want it centered horizontally, and ~20px above the top
        // Position "Temae" -> In front of the card (superimposed)
        // Center of the card
        menuPosition = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
  }

  function handleHandScroll() {
    if (selectedCardIndex !== null) {
      selectedCardIndex = null;
      menuPosition = null;
    }
  }

  function confirmPlay() {
    if (selectedCardIndex === null) return;

    // Only if affordable
    const card = gameState.player.hand[selectedCardIndex];
    if (gameState.player.pdsCurrent >= card.cost) {
      // Intercept for animation (ALL cards now)
      playingCardIndex = selectedCardIndex;
      playingCard = card;
      selectedCardIndex = null;
      menuPosition = null;
    } else {
      // Visualize error
      const el = document.getElementById(`hand-card-${selectedCardIndex}`);
      if (el) {
        gsap.to(el, { x: 5, duration: 0.1, yoyo: true, repeat: 3 });
      }
    }
  }

  function confirmArchive() {
    if (selectedCardIndex === null) return;
    if (gameState.phase === "main") {
      engine.archiveCard(selectedCardIndex);
      selectedCardIndex = null;
    }
  }

  function pdsBoost() {
    if (gameState.player.pdsCurrent >= GAME_CONFIG.pds.drawCost) {
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

  async function handleScoreAnimationComplete() {
    showScoreCalculation = false;
    engine.endTurn();

    // engine.endTurn updates buzzPoints -> triggers effect -> checks Rank
    // Wait for Svelte to process reactivity
    await tick();

    // If game over, do nothing (GameClear will show)
    if (gameState.gameOver) return;

    // Check if Rank Up is pending/active
    if (showRankUp || rankUpQueue.length > 0) {
      // Do NOT start turn yet.
      // Wait for handleRankUpComplete to call startTurn.
      console.log("Rank Up pending, pausing Turn Switch");
    } else {
      startTurn();
    }
  }

  // Computed
  let progressPercent = $derived(
    getRankProgress(gameState.player.buzzPoints).percent,
  );

  function handlePlayAgain() {
    // Re-initialize Game State
    const newState = GameEngine.createInitialState(
      did,
      handle,
      displayName,
      avatarDeck,
      contentDeck,
    );
    // Reset local state
    gameState = newState;
    engine.state = gameState; // Important: Update engine reference!
    selectedCardIndex = null;
    showScoreCalculation = false;
    showTurnTransition = false;
    animationLanes = [];
    menuPosition = null;
    currentRank = "G";
    rankUpQueue = [];
    showRankUp = false;
    displayingRank = "";

    // Start
    startTurn();
  }
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

  {#if showRankUp}
    <RankUp rank={displayingRank} onComplete={handleRankUpComplete} />
  {/if}

  {#if playingCard && playingCardIndex !== null}
    <PlayCardAnimation
      card={playingCard}
      displayPower={playingCard.power *
        gameState.phaseMultiplier *
        gameState.archiveMultiplier}
      onComplete={() => {
        if (playingCardIndex !== null) {
          engine.playCard(playingCardIndex);
          playingCard = null;
          playingCardIndex = null;
        }
      }}
    />
  {/if}

  <!-- HUD -->
  <div
    class="w-full flex flex-col md:flex-row bg-slate-800 border-b border-slate-700 z-20 shrink-0 relative pt-[env(safe-area-inset-top)]"
  >
    <!-- Progress Bar -->
    <div class="absolute bottom-0 left-0 w-full h-1 bg-slate-700">
      <div
        class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-out"
        style="width: {progressPercent}%"
      ></div>
    </div>

    <div
      class="grid grid-cols-[1fr_auto_auto] md:grid md:grid-cols-3 md:items-center px-2 py-2 md:px-8 gap-2 w-full"
    >
      <div
        class="flex items-center gap-1 col-span-2 md:col-span-1 md:justify-self-start"
      >
        <h1
          class="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 whitespace-nowrap"
        >
          {$t("turn")}
          {gameState.turnCount}/{GAME_CONFIG.maxTurns}
        </h1>
        <div class="w-px h-8 bg-slate-700 mx-1"></div>
        <div class="flex flex-col justify-center">
          <div
            class="md:text-sm uppercase tracking-widest text-slate-300 font-bold leading-tight"
          >
            <span class="text-yellow-400 whitespace-nowrap">
              <span class="hidden md:inline"
                >MULTIPLIER:
              </span>x{gameState.phaseMultiplier}
            </span>
          </div>
          {#if gameState.archiveMultiplier > 1}
            <span
              class="text-[10px] text-red-400 whitespace-nowrap animate-pulse font-black leading-tight"
            >
              Label: x{gameState.archiveMultiplier}
            </span>
          {/if}
        </div>
      </div>

      <!-- Center: Score & PDS -->
      <div
        class="flex flex-col items-center justify-center md:col-span-1 md:justify-self-center"
      >
        <!-- PDS Meter -->
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-bold text-slate-400 whitespace-nowrap"
            >PDS LOAD</span
          >
          <!-- Responsive PDS Container -->
          <div
            class="flex gap-[2px] h-4 max-w-[120px] md:max-w-[200px] items-center"
          >
            {#each Array(gameState.player.pdsCapacity) as _, i}
              <div
                class="h-full w-2 shrink rounded-[1px] min-w-[2px] {i <
                gameState.player.pdsCurrent
                  ? 'bg-pink-500 shadow-[0_0_5px_rgba(236,72,153,0.8)]'
                  : 'bg-slate-700'} transition-all"
              ></div>
            {/each}
          </div>
          <span class="text-xs font-mono text-pink-400 whitespace-nowrap"
            >{gameState.player.pdsCurrent}/{gameState.player.pdsCapacity}</span
          >
        </div>

        <div class="flex items-center gap-3">
          <div
            class="text-xl md:text-3xl font-black tabular-nums text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          >
            <AnimatedNumber value={gameState.player.buzzPoints} />
            <span class="text-sm md:text-xl">{$t("users")}</span>
          </div>
        </div>
      </div>

      <div
        class="md:col-span-1 md:justify-self-end flex items-center justify-end px-2"
      >
        <!-- Settings/Menu could go here -->
      </div>
    </div>
  </div>

  <!-- Main Game Area -->
  <div class="flex-grow flex relative overflow-hidden">
    <!-- Info Button (Field Top-Right) -->
    <div class="absolute top-4 right-4 z-10">
      <button
        class="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-blue-400 hover:text-white flex items-center justify-center transition-all backdrop-blur-md border border-slate-600 shadow-lg"
        onclick={onOpenInfo}
        aria-label="Game Info"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-6 h-6"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      </button>
    </div>

    <!-- Field -->
    <div
      class="flex-grow relative overflow-y-auto p-2 md:p-8 flex flex-col gap-4 items-center bg-slate-900/50 pb-32"
    >
      {#if gameState.player.field.length === 0}
        <div class="text-slate-600 font-bold text-2xl mt-20">
          {$t("noActiveUsers")}
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
          <div class="w-24 h-36 shrink-0 relative">
            <div class="origin-top-left scale-50 absolute top-0 left-0">
              <CardComponent card={lane.card} interactive={false} />
            </div>
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

  <!-- Global Action Menu (Dynamically Positioned) -->
  {#if selectedCardIndex !== null && gameState.phase === "main" && menuPosition}
    <!-- Backdrop to close -->
    <button
      class="fixed inset-0 z-[60] cursor-default bg-transparent"
      onclick={() => {
        selectedCardIndex = null;
        menuPosition = null;
      }}
      onkeydown={(e) => e.key === "Escape" && (selectedCardIndex = null)}
      aria-label="Close Menu"
    ></button>

    <div
      class="fixed z-[70] flex flex-col items-center gap-2 w-48 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
      style="left: {menuPosition.x}px; top: {menuPosition.y}px;"
    >
      <button
        class="pointer-events-auto w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.5)] border-2 border-blue-400 disabled:opacity-50 disabled:grayscale transition-all hover:scale-105 active:scale-95 flex flex-col items-center"
        onclick={confirmPlay}
        disabled={gameState.player.pdsCurrent <
          gameState.player.hand[selectedCardIndex].cost}
      >
        PLAY
        <span class="text-xs font-normal opacity-90"
          >Cost: {gameState.player.hand[selectedCardIndex].cost}</span
        >
      </button>

      <button
        class="pointer-events-auto px-6 py-2 bg-slate-900/90 hover:bg-red-900/90 text-slate-300 hover:text-white font-bold text-xs rounded-full shadow-lg backdrop-blur-md border border-slate-600 hover:border-red-500 transition-all hover:scale-105 disabled:opacity-50 disabled:grayscale"
        onclick={confirmArchive}
        disabled={gameState.player.pdsCurrent < GAME_CONFIG.pds.archiveCost}
      >
        LABEL<br />(Discard & Cost: {GAME_CONFIG.pds.archiveCost})
      </button>
    </div>
  {/if}

  <!-- Hand (Bottom) -->
  <div
    class="h-64 md:h-80 w-full bg-slate-800/95 border-t border-slate-700 flex flex-col z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 overflow-y-hidden pb-[env(safe-area-inset-bottom)]"
    onclick={() => (selectedCardIndex = null)}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Escape" && (selectedCardIndex = null)}
  >
    <div
      class="h-8 bg-black/20 flex items-center px-4 text-xs font-bold text-slate-400 gap-8"
      onclick={(e) => e.stopPropagation()}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.stopPropagation()}
    >
      <span>{$t("hand")}: {gameState.player.hand.length}</span>
      <span>{$t("deck")}: {gameState.player.deck.length}</span>
      <span>{$t("discard")}: {gameState.player.discard.length}</span>
      <span class="text-slate-500 font-normal ml-auto hidden md:block"
        >{$t("clickCardToSelect")}</span
      >
    </div>

    <div
      class="flex-grow flex items-end justify-start md:justify-center gap-2 md:gap-4 px-4 md:px-8 overflow-x-auto overflow-y-hidden pb-1 md:pb-4"
      onscroll={handleHandScroll}
    >
      {#each gameState.player.hand as card, i (card.uuid)}
        <div
          id="hand-card-{i}"
          class="relative transition-all duration-300 z-0 shrink-0 {selectedCardIndex ===
          i
            ? 'z-20 scale-110'
            : 'hover:z-10 group'}"
          style="transform: translateY({selectedCardIndex === i
            ? '-40px'
            : '0px'})"
          onclick={(e) => e.stopPropagation()}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.stopPropagation()}
          in:fly={{ y: 50, duration: 400, delay: i * 50 }}
        >
          <div
            class="scale-75 hover:scale-90 transition-transform origin-bottom"
          >
            <CardComponent
              {card}
              interactive={gameState.phase === "main"}
              displayPower={card.power *
                gameState.phaseMultiplier *
                gameState.archiveMultiplier}
              onClick={() => handleCardClick(i)}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Game Over Overlay -->
  {#if gameState.gameOver && gameState.finalRank}
    <GameClear
      score={gameState.player.buzzPoints}
      rank={gameState.finalRank}
      mvpCards={gameState.mvpCards}
      player={{
        displayName: gameState.player.displayName,
        handle: gameState.player.handle,
        avatarUrl: gameState.player.avatarUrl,
      }}
      allCards={[
        ...gameState.player.deck,
        ...gameState.player.hand,
        ...gameState.player.discard,
        ...gameState.player.field.map((l) => l.card),
      ]}
      onPlayAgain={handlePlayAgain}
    />
  {/if}

  <!-- Action Buttons Stack -->
  <div class="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-4">
    <!-- PDS Boost (Draw) -->
    <button
      class="p-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg shadow-xl hover:scale-105 transition-all border-2 border-pink-400/50 disabled:opacity-50 disabled:grayscale flex flex-col items-center leading-tight w-24"
      onclick={pdsBoost}
      disabled={gameState.gameOver ||
        gameState.phase !== "main" ||
        gameState.player.pdsCurrent < GAME_CONFIG.pds.drawCost}
    >
      <span class="text-sm">DRAW 1</span>
      <span class="text-[10px] opacity-80"
        >(Cost: {GAME_CONFIG.pds.drawCost})</span
      >
    </button>

    <!-- Turn Button -->
    <button
      class="w-24 h-16 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full shadow-2xl hover:scale-110 transition-all border-4 border-blue-400/50 disabled:opacity-50 disabled:grayscale"
      onclick={gameState.phase === "draw" ? startTurn : endTurn}
      disabled={gameState.gameOver}
    >
      {gameState.turnCount === 0
        ? "START"
        : gameState.phase === "draw"
          ? "DRAW"
          : "END"}
    </button>
  </div>

  {#if showScoreCalculation}
    <ScoreAnimation
      lanes={animationLanes}
      phaseMultiplier={gameState.phaseMultiplier}
      currentTotalScore={gameState.player.buzzPoints}
      onComplete={handleScoreAnimationComplete}
    />
  {/if}
</div>
