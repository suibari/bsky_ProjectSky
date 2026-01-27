<script lang="ts">
  import { onMount } from "svelte";
  import gsap from "gsap";
  import type { AvatarCard, ContentCard } from "../../game/types";
  import { t } from "$lib/i18n";

  let { lanes, previousTotal, onComplete } = $props<{
    lanes: {
      avatar: AvatarCard;
      contents: ContentCard[];
      avatarPower: number;
    }[];
    previousTotal: number;
    onComplete: () => void;
  }>();

  let container: HTMLDivElement;
  let laneElements: HTMLDivElement[] = $state([]);
  let snowballElement: HTMLDivElement;
  let totalScoreElement: HTMLDivElement;
  let finalScore = $state(previousTotal);
  let displayScore = $state(previousTotal);

  // Helper to calculate lane score specifics
  function getLaneDetails(lane: (typeof lanes)[0]) {
    const tagCounts: Record<string, number> = {};
    lane.contents.forEach((c: ContentCard) => {
      c.metadata?.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    let details: {
      card: ContentCard;
      val: number;
      isDoubled: boolean;
      isSquared: boolean;
    }[] = [];
    let currentMult = 1;

    lane.contents.forEach((content: ContentCard) => {
      let cardScore = content.buzzFactor;
      let isDoubled = false;
      let isSquared = false;

      // Metadata Bonus (x2)
      if (content.metadata?.some((tag: string) => tagCounts[tag] > 1)) {
        cardScore *= 2;
        isDoubled = true;
      }

      // Account Match Bonus (^2)
      if (content.authorDid && content.authorDid === lane.avatar.id) {
        cardScore = Math.pow(cardScore, 2);
        isSquared = true;
      }

      currentMult *= cardScore;

      details.push({
        card: content,
        val: cardScore,
        isDoubled,
        isSquared,
      });
    });

    return {
      details,
      totalMult: currentMult,
      laneTotal: lane.avatarPower * currentMult,
    };
  }

  onMount(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        setTimeout(onComplete, 1000);
      },
    });

    // 1. Fade in container
    tl.fromTo(container, { opacity: 0 }, { opacity: 1, duration: 0.5 });

    // 2. Animate each lane
    let currentRunningTotal = previousTotal;

    lanes.forEach((lane: (typeof lanes)[0], index: number) => {
      const { details, totalMult, laneTotal } = getLaneDetails(lane);
      const row = laneElements[index];
      if (!row) return; // Should not happen

      // Show Row
      tl.fromTo(
        row,
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
      );

      // Show Avatar Power
      const powerEl = row.querySelector(".avatar-power");
      tl.from(powerEl, {
        scale: 0,
        opacity: 0,
        duration: 0.3,
        ease: "elastic.out(1, 0.3)",
      });

      // Show multipliers sequentially
      const multEls = row.querySelectorAll(".mult-item");
      multEls.forEach((el, i) => {
        tl.from(el, { scale: 2, opacity: 0, duration: 0.2 }, "-=0.1");
      });

      // Show Lane Total
      const laneTotalEl = row.querySelector(".lane-total");
      tl.from(laneTotalEl, { opacity: 0, scale: 0.5, duration: 0.3 });

      // Update Big Score
      currentRunningTotal += laneTotal;
      tl.to(
        {},
        {
          duration: 0.8,
          ease: "power2.out",
          onStart: () => {
            gsap.to(proxy, {
              val: currentRunningTotal,
              duration: 0.8,
              ease: "power2.out",
              onUpdate: () => {
                displayScore = Math.round(proxy.val);
              },
            });
          },
        },
        "+=0.2",
      );
    });

    // 3. Snowball effect specific text if relevant
    if (previousTotal > 0) {
      currentRunningTotal += previousTotal;

      // Show Snowball Row
      tl.fromTo(
        snowballElement,
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
      );

      // Animate adding snowball to total
      tl.to(
        {},
        {
          duration: 1.0,
          ease: "power2.out",
          onStart: () => {
            gsap.to(proxy, {
              val: currentRunningTotal,
              duration: 1.0,
              ease: "power2.out",
              onUpdate: () => {
                displayScore = Math.round(proxy.val);
              },
            });
          },
        },
      );
    }

    // 4. Final fanfare
    tl.to(totalScoreElement, {
      scale: 1.2,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
    });
  });

  const proxy = { val: previousTotal };
</script>

<div
  bind:this={container}
  class="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-8 pointer-events-auto"
>
  <div class="w-full max-w-4xl flex flex-col gap-8">
    <h2
      class="text-4xl font-bold text-center text-white mb-8 tracking-widest uppercase border-b border-slate-700 pb-4"
    >
      {$t("endTurn")} Calculation
    </h2>

    <div class="flex flex-col gap-4">
      {#each lanes as lane, i}
        {@const { details, totalMult, laneTotal } = getLaneDetails(lane)}
        <div
          bind:this={laneElements[i]}
          class="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700"
        >
          <!-- Avatar -->
          <div class="flex flex-col items-center gap-1 shrink-0">
            <div
              class="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-400"
            >
              {#if lane.avatar.avatarUrl}
                <img
                  src={lane.avatar.avatarUrl}
                  alt={lane.avatar.handle}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div class="w-full h-full bg-slate-600"></div>
              {/if}
            </div>
            <div class="avatar-power text-2xl font-black text-blue-400">
              {lane.avatarPower}
            </div>
          </div>

          <div class="text-slate-400 font-bold text-xl">×</div>

          <!-- Multipliers -->
          <div class="flex flex-wrap gap-2 items-center flex-grow">
            {#each details as item}
              <div
                class="mult-item flex flex-col items-center bg-slate-700 px-3 py-1 rounded-lg border border-slate-600 relative"
              >
                <span class="text-xl font-bold text-white">
                  {item.val}
                </span>
                {#if item.isSquared}
                  <span
                    class="absolute -top-3 -right-3 text-xs bg-yellow-500 text-black font-bold px-1 rounded-sm shadow-md"
                    >^2</span
                  >
                {:else if item.isDoubled}
                  <span
                    class="absolute -top-3 -right-3 text-xs bg-green-500 text-black font-bold px-1 rounded-sm shadow-md"
                    >x2</span
                  >
                {/if}
              </div>
              <div class="text-slate-500 text-sm last:hidden">×</div>
            {/each}
            {#if details.length === 0}
              <span class="text-slate-500 italic text-sm">No Content</span>
            {/if}
          </div>

          <div class="text-slate-400 font-bold text-xl">=</div>

          <!-- Lane Total -->
          <div
            class="lane-total text-3xl font-black text-green-400 min-w-[100px] text-right"
          >
            +{laneTotal.toLocaleString()}
          </div>
        </div>
      {/each}
    </div>

    <!-- Snowball Bonus Row -->
    {#if previousTotal > 0}
      <div
        bind:this={snowballElement}
        class="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-blue-500/30 w-full"
      >
        <div class="flex items-center gap-2">
          <div
            class="text-blue-300 font-bold uppercase tracking-wider text-sm md:text-base"
          >
            Snowball Bonus (Previous Users)
          </div>
        </div>
        <div class="text-3xl font-black text-blue-400 min-w-[100px] text-right">
          +{previousTotal.toLocaleString()}
        </div>
      </div>
    {/if}

    <div class="mt-8 flex flex-col items-center">
      <div class="text-slate-400 text-sm uppercase tracking-wider">
        Total Users
      </div>
      <div
        bind:this={totalScoreElement}
        class="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] tabular-nums"
      >
        {Math.round(displayScore).toLocaleString()}
      </div>
    </div>
  </div>
</div>
