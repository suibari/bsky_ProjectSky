<script lang="ts">
    import { onMount, tick } from "svelte";
    import type { UserCard } from "$lib/game/types";
    import { t } from "$lib/i18n";
    import CardComponent from "../Card.svelte";
    import gsap from "gsap";

    let { card, onComplete } = $props<{
        card: UserCard;
        onComplete: () => void;
    }>();

    let container: HTMLDivElement;
    let mounted = false;

    onMount(() => {
        mounted = true;

        // Enter Animation
        gsap.fromTo(
            container,
            { x: 200, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.5, ease: "back.out(1.2)" },
        );

        const timer = setTimeout(() => {
            // Exit Animation
            gsap.to(container, {
                x: 200,
                opacity: 0,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => {
                    if (mounted) onComplete();
                },
            });
        }, 2500);

        return () => {
            mounted = false;
            clearTimeout(timer);
            gsap.killTweensOf(container);
        };
    });
</script>

<div
    class="fixed top-24 right-4 z-[100] flex flex-col items-end pointer-events-none"
>
    <div
        bind:this={container}
        class="relative flex flex-row items-center justify-end gap-3 mr-4 opacity-0"
    >
        <!-- User Card Visualization (Thumbnail) -->
        <div
            class="relative w-12 h-16 shrink-0 z-20 origin-center rotate-[-6deg] shadow-lg transition-transform ml-2"
        >
            <div class="absolute top-0 left-0 origin-top-left scale-[0.35]">
                <CardComponent
                    {card}
                    interactive={false}
                    displayPower={card.power}
                />
            </div>
        </div>

        <!-- Notification Bubble -->
        <div
            class="relative bg-white/95 backdrop-blur-sm text-slate-900 rounded-xl p-3 shadow-xl border-2 border-pink-500 flex flex-col items-start min-w-[160px] max-w-[240px] pointer-events-auto z-10"
        >
            <div
                class="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600 mb-0.5"
            >
                {$t("customFeed.thankYou")}
            </div>

            <div class="text-xs font-bold text-slate-600 leading-tight">
                {$t(`customFeed.effects.${card.customFeed?.effect}`)}
            </div>

            <!-- Tail (Left side pointing at Card) -->
            <div
                class="absolute top-1/2 -left-2 w-4 h-4 bg-white/95 border-b-2 border-l-2 border-pink-500 rotate-45 -translate-y-1/2"
            ></div>
        </div>
    </div>
</div>
