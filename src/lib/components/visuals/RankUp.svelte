<script lang="ts">
    import { onMount } from "svelte";
    import gsap from "gsap";
    import { t } from "$lib/i18n";
    import { Confetti } from "svelte-confetti";

    let { rank, onComplete } = $props<{
        rank: string;
        onComplete?: () => void;
    }>();

    let container: HTMLDivElement;
    let textRankUp: HTMLDivElement;
    let textRank: HTMLDivElement;

    onMount(() => {
        const tl = gsap.timeline({
            onComplete: () => {
                if (onComplete) onComplete();
            },
        });

        // Initial state
        gsap.set(container, { opacity: 1 });
        gsap.set([textRankUp, textRank], {
            scale: 0,
            opacity: 0,
        });

        // Animation Sequence
        // 1. "RANK UP!" Appears
        tl.to(textRankUp, {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(1.7)",
        });

        // 2. "Rank X" Appears below
        tl.to(
            textRank,
            {
                scale: 1,
                opacity: 1,
                duration: 0.6,
                ease: "elastic.out(1, 0.5)",
            },
            "-=0.2",
        );

        // 3. Hold
        tl.to({}, { duration: 2.0 });

        // 4. Fade Out
        tl.to(container, {
            opacity: 0,
            duration: 0.5,
        });
    });
</script>

<div
    bind:this={container}
    class="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px]"
>
    <!-- Confetti for high ranks -->
    {#if ["SS", "S", "A"].includes(rank)}
        <div
            class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
        >
            <Confetti
                x={[-5, 5]}
                y={[-5, 5]}
                delay={[0, 500]}
                duration={2000}
                amount={100}
                fallDistance="50vh"
            />
        </div>
    {/if}

    <div
        bind:this={textRankUp}
        class="text-6xl md:text-8xl font-black text-yellow-500 italic drop-shadow-[0_0_20px_rgba(234,179,8,0.8)] stroke-text mb-4"
        style="text-shadow: 0 0 10px rgba(0,0,0,0.8);"
    >
        RANK UP!
    </div>

    <div
        bind:this={textRank}
        class="text-5xl md:text-7xl font-bold text-white drop-shadow-xl flex flex-col items-center gap-2"
    >
        <div
            class="text-9xl text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-400"
        >
            {rank}
        </div>
        <div class="text-2xl md:text-4xl text-gray-200">
            {$t(("rank" + rank) as any)}
        </div>
    </div>
</div>

<style>
    .stroke-text {
        -webkit-text-stroke: 2px rgba(255, 255, 255, 0.8);
    }
</style>
