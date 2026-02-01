<script lang="ts">
    import { onMount } from "svelte";
    import gsap from "gsap";
    import type { Card } from "../../game/types";
    import CardComponent from "../Card.svelte";

    export let card: Card;
    export let onComplete = () => {};

    let container: HTMLDivElement;
    let cardContainer: HTMLDivElement;

    onMount(() => {
        const tl = gsap.timeline({
            onComplete: () => {
                onComplete();
            },
        });

        // Initial State
        gsap.set(container, { opacity: 0 });
        gsap.set(cardContainer, { scale: 0.5, rotationY: 10 });

        // 1. Appear (Scale Up & Rotate)
        tl.to(container, { opacity: 1, duration: 0.2 });
        tl.to(
            cardContainer,
            {
                scale: 1.5,
                rotationY: 0,
                duration: 0.5,
                ease: "back.out(1.2)",
            },
            "<",
        );

        // 2. Pause for reading/impact
        tl.to({}, { duration: 0.8 });

        // 3. Absorb Animation
        // Move to top center (Score Bar area) and scale down
        tl.to(cardContainer, {
            y: -window.innerHeight / 2 + 50, // Move towards top
            scale: 0.1,
            opacity: 0,
            duration: 0.5,
            ease: "power2.in",
        });

        // 4. Fade out overlay
        tl.to(container, { opacity: 0, duration: 0.2 }, "-=0.2");
    });
</script>

<div
    bind:this={container}
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none"
>
    <div bind:this={cardContainer} class="relative">
        <!-- Glow Effect -->
        <div
            class="absolute inset-0 bg-blue-500 blur-3xl opacity-50 rounded-full scale-110"
        ></div>

        <div class="pointer-events-none">
            <CardComponent {card} interactive={false} />
        </div>
    </div>
</div>
