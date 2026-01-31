<script lang="ts">
    import { t } from "$lib/i18n";
    import { fly, fade } from "svelte/transition";
    import { onMount } from "svelte";

    let { onClose } = $props<{ onClose: () => void }>();

    // Prevent background scrolling when modal is open
    onMount(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    });
</script>

<!-- Backdrop -->
<div
    class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
    onclick={onClose}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === "Escape" && onClose()}
    transition:fade
>
    <!-- Modal Content -->
    <div
        class="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="0"
        transition:fly={{ y: 50, duration: 300 }}
    >
        <!-- Header -->
        <div
            class="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/50 sticky top-0 z-10 backdrop-blur-md"
        >
            <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-8 h-8 text-blue-400"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                </svg>
                {$t("manual.title")}
            </h2>
            <button
                class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white flex items-center justify-center transition-all font-bold"
                onclick={onClose}
            >
                ✕
            </button>
        </div>

        <!-- Scrollable Body -->
        <div
            class="overflow-y-auto p-6 text-slate-300 leading-relaxed text-sm md:text-base space-y-8"
        >
            <!-- Intro -->
            <section>
                <p
                    class="whitespace-pre-line text-lg font-medium text-blue-100"
                >
                    {$t("manual.intro")}
                </p>
            </section>

            <!-- Goal -->
            <section>
                <h3
                    class="text-xl font-bold text-white mb-2 border-l-4 border-yellow-500 pl-3"
                >
                    {$t("manual.goalTitle")}
                </h3>
                <p class="whitespace-pre-line">{$t("manual.goalDesc")}</p>
            </section>

            <!-- Game Screen (Numbered List) -->
            <section>
                <h3
                    class="text-xl font-bold text-white mb-2 border-l-4 border-green-500 pl-3"
                >
                    {$t("manual.screenTitle")}
                </h3>

                <div
                    class="mb-4 rounded-lg overflow-hidden border border-slate-700 shadow-lg"
                >
                    <img
                        src="/game_screen.jpg"
                        alt="Game Screen"
                        class="w-full h-auto object-cover"
                    />
                </div>

                <ul class="space-y-1 mt-2">
                    {#each Object.entries($t("manual.screenItems")) as [key, text]}
                        <li class="flex gap-2">
                            <span
                                class="bg-slate-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            >
                                {key}
                            </span>
                            <span>{text}</span>
                        </li>
                    {/each}
                </ul>
            </section>

            <!-- Basic Rules -->
            <section>
                <h3
                    class="text-xl font-bold text-white mb-4 border-l-4 border-blue-500 pl-3"
                >
                    {$t("manual.basicTitle")}
                </h3>

                <div class="space-y-6 pl-2">
                    <!-- Card Types -->
                    <div>
                        <h4 class="text-lg font-bold text-slate-200 mb-1">
                            {$t("manual.cardTypesTitle")}
                        </h4>
                        <p class="mb-2">{$t("manual.cardTypesDesc")}</p>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div
                                class="bg-slate-800/50 p-4 rounded-lg border border-slate-700"
                            >
                                <h5 class="font-bold text-yellow-400 mb-1">
                                    {$t("manual.userCardTitle")}
                                </h5>
                                <p
                                    class="whitespace-pre-line text-xs md:text-sm"
                                >
                                    {$t("manual.userCardDesc")}
                                </p>
                            </div>
                            <div
                                class="bg-slate-800/50 p-4 rounded-lg border border-slate-700"
                            >
                                <h5 class="font-bold text-cyan-400 mb-1">
                                    {$t("manual.postCardTitle")}
                                </h5>
                                <p
                                    class="whitespace-pre-line text-xs md:text-sm"
                                >
                                    {$t("manual.postCardDesc")}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Deck -->
                    <div>
                        <h4 class="text-lg font-bold text-slate-200 mb-1">
                            {$t("manual.deckTitle")}
                        </h4>
                        <p class="whitespace-pre-line">
                            {$t("manual.deckDesc")}
                        </p>
                    </div>

                    <!-- Resources -->
                    <div>
                        <h4 class="text-lg font-bold text-slate-200 mb-1">
                            {$t("manual.resourceTitle")}
                        </h4>
                        <p class="whitespace-pre-line">
                            {$t("manual.resourceDesc")}
                        </p>
                    </div>

                    <!-- Turn -->
                    <div>
                        <h4 class="text-lg font-bold text-slate-200 mb-1">
                            {$t("manual.turnTitle")}
                        </h4>
                        <p class="whitespace-pre-line">
                            {$t("manual.turnDesc")}
                        </p>
                    </div>
                </div>
            </section>

            <!-- Other -->
            <section>
                <h3
                    class="text-xl font-bold text-white mb-4 border-l-4 border-purple-500 pl-3"
                >
                    {$t("manual.otherTitle")}
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-slate-800 p-4 rounded-lg">
                        <h4 class="font-bold text-pink-400 mb-1">
                            {$t("manual.boostTitle")}
                        </h4>
                        <p>{$t("manual.boostDesc")}</p>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-lg">
                        <h4 class="font-bold text-red-400 mb-1">
                            {$t("manual.archiveTitle")}
                        </h4>
                        <p>{$t("manual.archiveDesc")}</p>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-lg md:col-span-2">
                        <h4 class="font-bold text-yellow-400 mb-1">
                            {$t("manual.multiplierTitle")}
                        </h4>
                        <p class="whitespace-pre-line">
                            {$t("manual.multiplierDesc")}
                        </p>
                    </div>
                </div>
            </section>
        </div>

        <!-- Footer -->
        <div
            class="p-4 border-t border-slate-700 flex justify-end bg-slate-800/50"
        >
            <button
                class="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition-colors"
                onclick={onClose}
            >
                {$t("close")}
            </button>
        </div>
    </div>
</div>
