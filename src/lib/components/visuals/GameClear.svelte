<script lang="ts">
  import { onMount } from "svelte";
  import { Confetti } from "svelte-confetti";
  import gsap from "gsap";
  import { t } from "$lib/i18n";

  import CardComponent from "../Card.svelte";
  import type { UserCard, PostCard } from "../../game/types";

  let { score, rank, mvpCards } = $props<{
    score: number;
    rank: string;
    mvpCards?: { user: UserCard | null; post: PostCard | null };
  }>();

  let textElement: HTMLDivElement;

  onMount(() => {
    // Animate Text
    gsap.fromTo(
      textElement,
      { scale: 0.8, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        delay: 0.2,
      },
    );
  });
</script>

<div
  class="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center overflow-hidden"
>
  <!-- Confetti Cannon -->
  {#if rank === "SS"}
    <div
      class="absolute -top-50 inset-0 flex h-full w-full pointer-events-none"
    >
      <Confetti
        x={[-5, 5]}
        y={[0, 0.1]}
        delay={[0, 5000]}
        infinite
        duration={5000}
        amount={200}
        fallDistance="100vh"
      />
    </div>
  {/if}

  <!-- Background Overlay -->
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm -z-10"></div>

  <!-- Text -->
  <div
    bind:this={textElement}
    class="relative z-10 flex flex-col items-center justify-center p-8 text-center h-full pb-32 pointer-events-auto"
  >
    <h1
      class="text-6xl md:text-9xl font-black text-white italic tracking-tighter mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
    >
      {#if rank === "SS"}
        GAME CLEAR!!
      {:else}
        FINISH
      {/if}
    </h1>

    <div
      class="text-xl md:text-3xl text-gray-300 font-bold tracking-widest mb-12 uppercase"
    >
      Score: {score.toLocaleString()}
    </div>

    <!-- Rank Title -->
    <div
      class="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] mb-16 tracking-tight"
    >
      {$t(("rank" + rank) as any)}
    </div>

    <!-- MVP Cards -->
    {#if mvpCards}
      <div
        class="flex flex-col md:flex-row gap-8 items-center justify-center mb-32"
      >
        {#if mvpCards.user}
          <div class="flex flex-col items-center gap-2">
            <div class="text-yellow-400 font-bold text-xl drop-shadow-md">
              {$t("mvpUser")}
            </div>
            <div
              class="pointer-events-auto hover:scale-110 transition-transform duration-300"
            >
              <CardComponent
                card={mvpCards.user}
                interactive={false}
                displayPower={mvpCards.user.power}
              />
            </div>
          </div>
        {/if}

        {#if mvpCards.post}
          <div class="flex flex-col items-center gap-2">
            <div class="text-cyan-400 font-bold text-xl drop-shadow-md">
              {$t("mvpPost")}
            </div>
            <div
              class="pointer-events-auto hover:scale-110 transition-transform duration-300"
            >
              <CardComponent
                card={mvpCards.post}
                interactive={false}
                displayPower={mvpCards.post.playedScore ?? mvpCards.post.power}
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Button Fixed Bottom -->
  <div
    class="fixed bottom-16 left-1/2 -translate-x-1/2 z-[310] pointer-events-auto"
  >
    <button
      class="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-110 transition shadow-xl border-4 border-yellow-400"
      onclick={() => location.reload()}
    >
      {$t("playAgain")}
    </button>
  </div>
</div>
