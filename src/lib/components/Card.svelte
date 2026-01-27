<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { AvatarCard, ContentCard } from "../game/types";
  import favicon from "$lib/assets/favicon.svg";

  export let card: AvatarCard | ContentCard;
  export let faceUp = true;
  export let onClick: () => void = () => {};
  export let interactive = false;

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
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  bind:this={cardElement}
  class="relative w-48 h-72 rounded-xl shadow-2xl cursor-pointer preserve-3d transition-transform hover:scale-105"
  on:click={handleClick}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === "Enter" && handleClick()}
>
  <!-- Front -->
  <div
    class="absolute w-full h-full bg-white/90 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden backface-hidden flex flex-col items-center justify-between text-black relative group"
  >
    {#if card.type === "avatar"}
      <!-- Avatar Design -->
      <div
        class="absolute top-2 left-3 text-xs font-bold z-10 drop-shadow-md text-slate-800"
      >
        {card.displayName || "@" + card.handle}
      </div>

      <div
        class="flex-grow flex items-center justify-center relative mt-4 w-full px-2"
      >
        {#if card.avatarUrl}
          <img
            src={card.avatarUrl}
            alt="Avatar"
            class="w-full h-48 object-cover rounded-lg shadow-inner"
          />
        {:else}
          <div
            class="w-full aspect-square bg-gray-200 rounded-full flex items-center justify-center border-4 border-white"
          >
            No Image
          </div>
        {/if}
      </div>

      <!-- Stats (Avatar) -->
      <div
        class="absolute bottom-2 right-3 text-2xl font-black text-blue-600 drop-shadow-sm"
      >
        {card.buzzPower}
      </div>
    {:else}
      <!-- Content Card -->
      <!-- Image Background -->
      {#if card.imageUrl}
        <img
          src={card.imageUrl}
          alt="Background"
          class="absolute inset-0 w-full h-full object-cover z-0"
        />
        <div class="absolute inset-0 bg-black/60 z-0"></div>
        <!-- Scrim -->
      {/if}

      <div class="relative z-10 p-4 flex flex-col h-full w-full">
        <!-- Metadata Tags -->
        <div class="flex flex-wrap gap-1 mb-2">
          {#if card.metadata}
            {#each card.metadata as tag}
              <span
                class="px-1.5 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider
                        {card.imageUrl
                  ? 'bg-white/20 text-white backdrop-blur-sm'
                  : 'bg-slate-200 text-slate-600'}"
              >
                #{tag}
              </span>
            {/each}
          {/if}
        </div>

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
            class="w-full text-right text-[10px] font-serif font-bold text-slate-600 shrink-0 {card.imageUrl
              ? 'text-white'
              : ''}"
          >
            ―― {card.authorDisplayName || "@" + card.authorHandle}
          </div>
        </div>
      </div>

      <!-- Stats (Content) -->
      <div
        class="absolute bottom-2 right-3 text-2xl font-black z-20 drop-shadow-md {card.imageUrl
          ? 'text-blue-300'
          : 'text-blue-600'}"
      >
        x{card.buzzFactor}
      </div>
    {/if}

    <!-- Decoration -->
    <div
      class="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-400 rounded-full blur-2xl opacity-20 pointer-events-none"
    ></div>
  </div>

  <!-- Back -->
  <div
    class="absolute w-full h-full bg-white rounded-xl border-4 border-blue-500 overflow-hidden backface-hidden rotate-y-180 flex items-center justify-center"
  >
    <!-- Butterfly Mark -->
    <img src={favicon} alt="Bluesky" class="w-24 h-24 opacity-80" />
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
