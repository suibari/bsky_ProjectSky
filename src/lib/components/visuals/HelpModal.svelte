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
                        <h4 class="font-bold text-orange-400 mb-1">
                            {$t("manual.moderationTitle")}
                        </h4>
                        <p>{$t("manual.moderationDesc")}</p>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-lg md:col-span-2">
                        <h4 class="font-bold text-teal-400 mb-1">
                            {$t("manual.relayTitle")}
                        </h4>
                        <p>{$t("manual.relayDesc")}</p>
                    </div>
                    <div class="bg-slate-800 p-4 rounded-lg md:col-span-2">
                        <h4 class="font-bold text-teal-400 mb-1">
                            {$t("manual.feedTitle")}
                        </h4>
                        <p>{$t("manual.feedDesc")}</p>
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

            <!-- Links -->
            <section>
                <h3
                    class="text-xl font-bold text-white mb-4 border-l-4 border-gray-500 pl-3"
                >
                    {$t("manual.linksTitle")}
                </h3>
                <div class="flex flex-col gap-2 pl-2">
                    <a
                        href="https://bsky.app/profile/suibari.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            fill="currentColor"
                            class="bi bi-bluesky shrink-0"
                            viewBox="0 0 16 16"
                        >
                            <path
                                d="M3.468 1.948C5.303 3.325 7.276 6.118 8 7.616c.725-1.498 2.698-4.29 4.532-5.668C13.855.955 16 .186 16 2.632c0 .489-.28 4.105-.444 4.692-.572 2.04-2.653 2.561-4.504 2.246 3.236.551 4.06 2.375 2.281 4.2-3.376 3.464-4.852-.87-5.23-1.98-.07-.204-.103-.3-.103-.218 0-.081-.033.014-.102.218-.379 1.11-1.855 5.444-5.231 1.98-1.778-1.825-.955-3.65 2.28-4.2-1.85.315-3.932-.205-4.503-2.246C.28 6.737 0 3.12 0 2.632 0 .186 2.145.955 3.468 1.948"
                            />
                        </svg>
                        {$t("manual.bskyText")}
                    </a>
                    <a
                        href="https://github.com/suibari/bsky_ProjectSky"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="shrink-0"
                        >
                            <path
                                d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                            />
                        </svg>
                        {$t("manual.githubText")}
                    </a>
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
