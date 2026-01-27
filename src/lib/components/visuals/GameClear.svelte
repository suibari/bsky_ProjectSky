<script lang="ts">
  import { onMount } from "svelte";
  import { Confetti } from "svelte-confetti";
  import gsap from "gsap";
  import { t } from "$lib/i18n";

  let { score } = $props<{ score: number }>();

  let textElement: HTMLDivElement;

  onMount(() => {
    // Animate Text
    gsap.fromTo(
      textElement,
      { scale: 0, rotation: -45, opacity: 0 },
      {
        scale: 1,
        rotation: -5,
        opacity: 1,
        duration: 1,
        ease: "elastic.out(1, 0.3)",
        delay: 0.5,
      },
    );
  });
</script>

<div
  class="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center overflow-hidden"
>
  <!-- Confetti Cannon -->
  <div class="absolute -top-50 inset-0 flex h-full w-full pointer-events-none">
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

  <!-- Text -->
  <div
    bind:this={textElement}
    class="relative z-10 flex flex-col items-center justify-center p-8 text-center h-full pb-32 pointer-events-auto"
  >
    <h1
      class="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-200 drop-shadow-[0_10px_20px_rgba(234,179,8,0.5)] italic tracking-tighter -rotate-6 mb-8"
    >
      GAME CLEAR!
    </h1>

    <div
      class="text-2xl md:text-4xl text-white font-bold drop-shadow-md mb-4 bg-black/30 p-4 rounded-xl backdrop-blur-sm"
    >
      {$t("victory")}
    </div>

    <div
      class="text-xl md:text-2xl text-blue-200 font-bold drop-shadow-md mb-8"
    >
      Score: {score.toLocaleString()}
    </div>
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
