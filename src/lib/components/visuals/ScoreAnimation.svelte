<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { UserCard } from "../../game/types";
  import { t } from "$lib/i18n";

  let {
    lanes,
    phaseMultiplier = 1,
    onComplete,
  } = $props<{
    lanes: {
      card: UserCard;
    }[];
    phaseMultiplier: number;
    onComplete: () => void;
  }>();

  let container = $state<HTMLDivElement>();
  let itemsContainer = $state<HTMLDivElement>();
  let totalScoreElement = $state<HTMLDivElement>();
  let displayScore = $state(0);

  // Pre-calculate totals
  let totalPower = $derived(
    lanes.reduce((acc: number, l: { card: UserCard }) => acc + l.card.power, 0),
  );
  let finalScore = $derived(totalPower * phaseMultiplier);

  onMount(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setTimeout(onComplete, 1200);
      },
    });

    // 1. Fade in container
    tl.fromTo(container!, { opacity: 0 }, { opacity: 1, duration: 0.3 });

    // 2. Animate items (Grid Stagger)
    if (lanes.length > 0) {
      tl.from(".score-item", {
        scale: 0,
        opacity: 0,
        y: 20,
        stagger: {
          amount: 0.5, // Total time for all items to appear is 0.5s max
          grid: "auto",
          from: "center",
        },
        duration: 0.4,
        ease: "back.out(1.5)",
      });
    }

    // 3. Animate Score Calculation
    tl.to({}, { duration: 0.2 }); // small pause

    tl.to(proxy, {
      val: finalScore,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        displayScore = Math.round(proxy.val);
      },
    });

    // 4. Final Pulse
    tl.to(
      totalScoreElement!,
      { scale: 1.1, duration: 0.15, yoyo: true, repeat: 1 },
      "<+=0.4",
    );
  });

  const proxy = { val: 0 };
</script>

<div
  bind:this={container}
  class="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 pointer-events-auto"
>
  <div class="w-full max-w-4xl flex flex-col gap-6 max-h-full">
    <!-- Title Area (Compact) -->
    <div class="text-center border-b border-slate-700 pb-2">
      <h2 class="text-2xl font-bold text-white tracking-widest uppercase">
        {$t("endTurn")} Report
      </h2>
    </div>

    <!-- Active Users Grid -->
    {#if lanes.length > 0}
      <div class="flex-grow overflow-y-auto min-h-0 p-2">
        <div
          bind:this={itemsContainer}
          class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 justify-center"
        >
          {#each lanes as lane}
            <div class="score-item flex flex-col items-center gap-1 group">
              <!-- Avatar -->
              <div
                class="w-12 h-12 rounded-full border-2 border-blue-500 overflow-hidden relative shadow-lg group-hover:scale-110 transition-transform"
              >
                {#if lane.card.avatarUrl}
                  <img
                    src={lane.card.avatarUrl}
                    alt=""
                    class="w-full h-full object-cover"
                  />
                {:else}
                  <div class="w-full h-full bg-slate-700"></div>
                {/if}
                <!-- Power Badge -->
                <div
                  class="absolute bottom-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-1 rounded-tl-md"
                >
                  {lane.card.power}
                </div>
              </div>
              <!-- Name (Truncated) -->
              <div
                class="text-[9px] text-slate-400 max-w-full truncate w-14 text-center"
              >
                {lane.card.displayName || lane.card.handle}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="h-32 flex items-center justify-center text-slate-500 italic">
        No Active Users
      </div>
    {/if}

    <!-- Calculation Footer -->
    <div
      class="mt-auto bg-slate-800/80 rounded-2xl p-6 border border-slate-700 flex flex-col items-center shadow-2xl"
    >
      <div
        class="flex items-center gap-4 md:gap-8 text-lg md:text-2xl font-mono text-slate-300 mb-2"
      >
        <div class="flex flex-col items-center">
          <span class="text-xs uppercase text-slate-500 font-sans font-bold"
            >Total Power</span
          >
          <span class="text-blue-400 font-bold"
            >{totalPower.toLocaleString()}</span
          >
        </div>
        <span class="text-slate-600">×</span>
        <div class="flex flex-col items-center">
          <span class="text-xs uppercase text-slate-500 font-sans font-bold"
            >Multiplier</span
          >
          <span class="text-yellow-400 font-bold">x{phaseMultiplier}</span>
        </div>
        <span class="text-slate-600">=</span>
      </div>

      <div
        bind:this={totalScoreElement}
        class="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 drop-shadow-[0_0_15px_rgba(74,222,128,0.4)] tabular-nums"
      >
        +{Math.round(displayScore).toLocaleString()}
      </div>
    </div>
  </div>
</div>
