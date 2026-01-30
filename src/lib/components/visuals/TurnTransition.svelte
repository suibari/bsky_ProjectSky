<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import { t } from "$lib/i18n";

  let { turn, onCovered, onComplete } = $props<{
    turn: number;
    onCovered?: () => void;
    onComplete: () => void;
  }>();

  let container: HTMLDivElement;
  let topSlice: HTMLDivElement;
  let bottomSlice: HTMLDivElement;
  let textContainer: HTMLDivElement;

  onMount(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        onComplete();
      },
    });

    // 1. Slash In
    tl.to([topSlice, bottomSlice], {
      x: "0%",
      duration: 0.3,
      ease: "power4.out",
      onComplete: () => {
        if (onCovered) onCovered();
      },
    });

    // 2. Text Impact
    tl.fromTo(
      textContainer,
      { scale: 2, opacity: 0, rotation: -10 },
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.4,
        ease: "elastic.out(1, 0.5)",
      },
    );

    // 3. Hold reading time
    tl.to({}, { duration: 0.8 });

    // 4. Slash Out (Reveal Next Turn)
    tl.to(topSlice, { x: "100%", duration: 0.3, ease: "power2.in" }, "exit");
    tl.to(
      bottomSlice,
      { x: "-100%", duration: 0.3, ease: "power2.in" },
      "exit",
    );
    tl.to(textContainer, { opacity: 0, scale: 0.5, duration: 0.2 }, "exit");
  });
</script>

<div
  bind:this={container}
  class="fixed inset-0 z-[200] pointer-events-none overflow-hidden flex items-center justify-center"
>
  <!-- Top Slice (Black background, diagonal cut) -->
  <div
    bind:this={topSlice}
    class="absolute top-0 left-0 w-full h-[60%] bg-slate-900/90 z-10 -translate-x-full"
    style="clip-path: polygon(0 0, 100% 0, 100% 80%, 0% 100%);"
  ></div>

  <!-- Bottom Slice -->
  <div
    bind:this={bottomSlice}
    class="absolute bottom-0 right-0 w-full h-[60%] bg-slate-900/90 z-10 translate-x-full"
    style="clip-path: polygon(0 20%, 100% 0%, 100% 100%, 0% 100%);"
  ></div>

  <!-- Text Content -->
  <div
    bind:this={textContainer}
    class="relative z-20 flex flex-col items-center justify-center text-white mix-blend-difference"
  >
    <div
      class="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-stroke-white"
    >
      {$t("turn")}
    </div>
    <div
      class="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-white -mt-4"
    >
      {turn}
    </div>
  </div>
</div>
