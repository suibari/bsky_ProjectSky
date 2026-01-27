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
  <div
    class="absolute inset-0 flex items-center justify-center pointer-events-none"
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

  <!-- Text -->
  <div bind:this={textElement} class="relative z-10 flex flex-col items-center">
    <h1
      class="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-200 drop-shadow-[0_10px_20px_rgba(234,179,8,0.5)] italic tracking-tighter -rotate-6"
    >
      GAME CLEAR!
    </h1>
    <div class="mt-8 text-4xl text-white font-bold drop-shadow-md">
      Score: {score.toLocaleString()}
    </div>
  </div>
</div>
