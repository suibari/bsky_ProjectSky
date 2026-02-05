<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { Card } from "../game/types";
  import favicon from "$lib/assets/favicon.svg";
  import AnimatedNumber from "$lib/components/AnimatedNumber.svelte";
  import { t } from "$lib/i18n";

  export let card: Card;
  export let faceUp = true;
  export let onClick = () => {};
  export let onContextmenu = () => {};
  export let interactive = false;
  export let displayPower: number | undefined = undefined; // For previewing buffs
  export let isTransitioning = false;

  let cardElement: HTMLElement;

  // Flip animation
  $: if (cardElement) {
    gsap.to(cardElement, {
      rotationY: faceUp ? 0 : 180,
      duration: 0.6,
      ease: "power2.out",
    });
  }

  function handleClick() {
    if (interactive) {
      onClick();
    }
  }

  function handleContextmenu() {
    if (interactive) {
      onContextmenu();
    }
  }

  let showModeratedLabel = false;
  let lastModeratedValue = card.lastModeratedTurn;
  let pendingModeration = false;

  // Initialize with the current effective power
  let currentDisplayValue = displayPower ?? card.power;

  // Reactively track the target value (what inputs say we should be)
  $: targetValue = displayPower ?? card.power;

  $: {
    // Detect Moderation Event
    if (card.lastModeratedTurn !== lastModeratedValue) {
      lastModeratedValue = card.lastModeratedTurn;

      // Only show label if moderation actually happened (not cleared)
      if (card.lastModeratedTurn !== undefined) {
        if (isTransitioning) {
          pendingModeration = true;
        } else {
          showModeratedLabel = true;
          currentDisplayValue = targetValue;
          setTimeout(() => {
            showModeratedLabel = false;
          }, 2000);
        }
      } else {
        // Moderation Cleared
        currentDisplayValue = targetValue;
      }
    } else {
      // No new moderation event this tick
      if (!pendingModeration) {
        currentDisplayValue = targetValue;
      }
    }
  }

  // Handle Unfreeze when transition ends
  $: if (!isTransitioning && pendingModeration) {
    pendingModeration = false;
    showModeratedLabel = true;
    currentDisplayValue = targetValue; // SNAP/Animate to new value
    setTimeout(() => {
      showModeratedLabel = false;
    }, 2000);
  }

  let showHydratedLabel = false;
  let lastHydratedValue = card.lastHydratedTrigger;

  $: if (card.lastHydratedTrigger !== lastHydratedValue) {
    lastHydratedValue = card.lastHydratedTrigger;
    showHydratedLabel = true;
    setTimeout(() => {
      showHydratedLabel = false;
    }, 2000);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  bind:this={cardElement}
  class="relative w-48 h-72 rounded-xl shadow-2xl cursor-pointer preserve-3d transition-transform hover:scale-105"
  on:click={handleClick}
  on:contextmenu|preventDefault={handleContextmenu}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === "Enter" && handleClick()}
>
  <!-- Front -->
  <div
    class="absolute w-full h-full bg-white/90 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden backface-hidden flex flex-col items-center justify-between text-black relative group"
  >
    <!-- Cost (Top Right) -->
    <div class="absolute top-2 right-3 z-20 flex flex-col items-end">
      <div
        class="text-[10px] uppercase font-bold text-slate-500 tracking-wider"
      >
        PDS
      </div>
      <div class="text-xl font-black text-pink-500 drop-shadow-sm leading-none">
        {card.cost}
      </div>
    </div>

    {#if card.type === "user"}
      <!-- Avatar Design -->
      <div
        class="absolute top-2 left-3 text-xs font-bold z-10 drop-shadow-md text-slate-800 max-w-[70%]"
      >
        {card.displayName || "@" + card.handle}
      </div>

      <div
        class="flex-grow flex items-center justify-center relative w-full px-2"
      >
        {#if card.avatarUrl}
          <img
            src={card.avatarUrl}
            alt="Avatar"
            class="w-full h-40 object-cover rounded-lg shadow-inner"
          />
        {:else}
          <div
            class="w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center border-4 border-white"
          >
            No Image
          </div>
        {/if}
      </div>

      <!-- Power (User) -->
      <div class="absolute bottom-2 left-3 text-left z-20">
        <div
          class="text-[10px] uppercase font-bold text-slate-500 tracking-wider"
        >
          Power/Turn
        </div>
        <div class="text-2xl font-black text-blue-600 drop-shadow-sm">
          <AnimatedNumber value={currentDisplayValue} />
        </div>
      </div>
    {:else}
      <!-- Post Card -->
      <!-- Image Background -->
      {#if card.imageUrl}
        <img
          src={card.imageUrl}
          alt="Background"
          class="absolute inset-0 w-full h-full object-cover z-0"
        />
        <div class="absolute inset-0 bg-black/60 z-0"></div>
      {/if}

      <div class="relative z-10 p-4 flex flex-col h-full w-full pt-8">
        <div
          class="flex-grow flex flex-col justify-center items-center overflow-hidden"
        >
          <!-- Text -->
          <p
            class="font-serif italic text-center leading-relaxed text-xs break-words w-full {card.imageUrl
              ? 'text-white drop-shadow-md font-medium'
              : 'text-slate-900'}"
          >
            "{card.text}"
          </p>
          <!-- Name -->
          <div
            class="w-full text-right text-[10px] font-serif font-bold text-slate-600 shrink-0 mt-2 {card.imageUrl
              ? 'text-white'
              : ''}"
          >
            ―― {card.displayName || "@" + card.handle}
          </div>
        </div>
      </div>

      <!-- Power (Post) -->
      <div
        class="absolute bottom-2 left-3 text-left z-20 {card.imageUrl
          ? 'text-blue-300'
          : 'text-blue-600'}"
      >
        <div class="text-[10px] uppercase font-bold tracking-wider opacity-80">
          Power (Instant)
        </div>
        <div class="text-2xl font-black drop-shadow-md">
          <AnimatedNumber value={currentDisplayValue} />
        </div>
      </div>
    {/if}

    <!-- Type Icon/Label (Bottom Right) -->
    <!-- <div class="absolute bottom-2 right-3 z-10">
      {#if card.type === "user"}
        <span class="text-2xl" title="User Card">👤</span>
      {:else}
        <span class="text-2xl" title="Post Card">📝</span>
      {/if}
    </div> -->

    {#if showModeratedLabel}
      <div
        class="absolute inset-0 flex items-center justify-center z-50 pointer-events-none animate-bounce"
      >
        <div
          class="bg-red-600 text-white font-black px-4 py-2 rounded border-4 border-white shadow-xl rotate-12 opacity-90 flex flex-col items-center leading-tight min-w-[140px]"
        >
          <div class="text-2xl drop-shadow-md">Moderated!!</div>
          <div class="text-xs font-bold whitespace-nowrap opacity-90">
            {$t("handPenalty")}
          </div>
        </div>
      </div>
    {/if}

    {#if showHydratedLabel}
      <div
        class="absolute inset-0 flex items-center justify-center z-50 pointer-events-none animate-bounce"
      >
        <div
          class="bg-blue-500 text-white font-black px-4 py-2 rounded border-4 border-white shadow-xl -rotate-12 opacity-90 flex flex-col items-center leading-tight min-w-[140px]"
        >
          <div class="text-2xl drop-shadow-md">Hydrated!!</div>
          <div class="text-xs font-bold whitespace-nowrap opacity-90">
            {$t("postBonus")}
          </div>
        </div>
      </div>
    {/if}

    <!-- Decoration -->
    <div
      class="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-400 rounded-full blur-2xl opacity-20 pointer-events-none"
    ></div>

    {#if card.origin === "extended"}
      <div class="shiny-overlay pointer-events-none"></div>
    {/if}
  </div>

  <!-- Back -->
  <div
    class="absolute w-full h-full bg-slate-800 rounded-xl border-4 border-blue-500 overflow-hidden backface-hidden rotate-y-180 flex items-center justify-center"
  >
    <!-- Butterfly Mark -->
    <img
      src={favicon}
      alt="Bluesky"
      class="w-24 h-24 opacity-50 grayscale invert"
    />
  </div>
</div>

<style>
  .preserve-3d {
    transform-style: preserve-3d;
  }
  .backface-hidden {
    backface-visibility: hidden;
  }
  .rotate-y-180 {
    transform: rotateY(180deg);
  }

  .shiny-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      105deg,
      transparent 20%,
      rgba(255, 255, 255, 0.2) 40%,
      rgba(255, 255, 255, 0.8) 45%,
      rgba(255, 230, 120, 0.6) 50%,
      /* Gold tint */ rgba(255, 255, 255, 0.8) 55%,
      rgba(255, 255, 255, 0.2) 60%,
      transparent 80%
    );
    transform: rotate(-30deg) translate(-100%, -100%);
    animation: shine 6s infinite cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
    z-index: 50;
    mix-blend-mode: overlay;
  }

  @keyframes shine {
    0% {
      transform: rotate(-30deg) translate(-150%, -150%);
    }
    15% {
      transform: rotate(-30deg) translate(50%, 50%);
    }
    100% {
      transform: rotate(-30deg) translate(50%, 50%);
    }
  }
</style>
