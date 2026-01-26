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
    class="absolute w-full h-full bg-white/90 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden backface-hidden flex flex-col p-3 text-black"
  >
    <div
      class="absolute top-2 left-3 text-xs font-bold z-10 drop-shadow-md text-slate-800"
    >
      {#if card.type === "avatar"}
        @{card.handle}
      {:else}
        @{card.authorHandle}
      {/if}
    </div>

    <div class="flex-grow flex items-center justify-center relative mt-4">
      {#if card.type === "avatar"}
        {#if card.avatarUrl}
          <img
            src={card.avatarUrl}
            alt="Avatar"
            class="w-full h-48 object-cover rounded-lg shadow-inner"
          />
        {:else}
          <div
            class="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center"
          >
            No Image
          </div>
        {/if}
      {:else}
        <!-- Content Card -->
        <div class="w-full h-full flex flex-col gap-2 overflow-hidden text-sm">
          {#if card.imageUrl}
            <img
              src={card.imageUrl}
              alt="Content"
              class="w-full h-32 object-cover rounded-md"
            />
          {/if}
          <p class="line-clamp-6 leading-snug">{card.text}</p>
        </div>
      {/if}
    </div>

    <div
      class="absolute bottom-2 right-3 text-2xl font-black text-blue-600 drop-shadow-sm"
    >
      {#if card.type === "avatar"}
        {card.buzzPower}
      {:else}
        {card.buzzFactor}
      {/if}
    </div>

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
