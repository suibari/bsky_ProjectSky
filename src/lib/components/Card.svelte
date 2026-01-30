<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { Card } from "../game/types";
  import favicon from "$lib/assets/favicon.svg";
  import AnimatedNumber from "$lib/components/AnimatedNumber.svelte";

  export let card: Card;
  export let faceUp = true;
  export let onClick = () => {};
  export let onContextmenu = () => {};
  export let interactive = false;
  export let displayPower: number | undefined = undefined; // For previewing buffs

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
          <AnimatedNumber value={displayPower ?? card.power} />
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
          <AnimatedNumber value={displayPower ?? card.power} />
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

    <!-- Decoration -->
    <div
      class="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-400 rounded-full blur-2xl opacity-20 pointer-events-none"
    ></div>
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
</style>
