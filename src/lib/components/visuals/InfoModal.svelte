<script lang="ts">
    import { t } from "$lib/i18n";
    import { fly, fade } from "svelte/transition";
    import { onMount } from "svelte";
    import CardComponent from "../Card.svelte";

    let { onClose } = $props<{ onClose: () => void }>();

    // Prevent background scrolling
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
        class="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto relative"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="0"
        transition:fly={{ y: 20, duration: 300 }}
    >
        <!-- Header -->
        <div class="p-6 pb-2 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-white flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="w-7 h-7 text-blue-400"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                    />
                </svg>
                Project Sky
            </h2>
            <button
                class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white flex items-center justify-center transition-all font-bold"
                onclick={onClose}
            >
                ✕
            </button>
        </div>

        <!-- Body -->
        <div class="p-6 pt-2 overflow-y-auto max-h-[70vh]">
            <p class="text-blue-100 font-medium mb-6 leading-relaxed">
                {$t("info.intro")}
            </p>

            <div class="space-y-4">
                <!-- Step 1 -->
                <div
                    class="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex gap-4 items-start"
                >
                    <div
                        class="bg-blue-600 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    >
                        1
                    </div>
                    <div>
                        <p class="font-bold text-white text-lg">
                            {$t("info.step1")}
                        </p>
                    </div>
                </div>

                <!-- Step 2 -->
                <div
                    class="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex gap-4 items-start"
                >
                    <div
                        class="bg-blue-600 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    >
                        2
                    </div>
                    <div>
                        <p class="font-bold text-white text-lg">
                            {$t("info.step2")}
                        </p>
                    </div>
                </div>

                <!-- Step 3 -->
                <div
                    class="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex gap-4 items-start"
                >
                    <div
                        class="bg-blue-600 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    >
                        3
                    </div>
                    <div>
                        <p class="font-bold text-white text-lg">
                            {$t("info.step3")}
                        </p>
                    </div>
                </div>

                <!-- Step 4 -->
                <div
                    class="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex gap-4 items-start"
                >
                    <div
                        class="bg-blue-600 text-white font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    >
                        4
                    </div>
                    <div>
                        <p class="font-bold text-white text-lg">
                            {$t("info.step4")}
                        </p>
                    </div>
                </div>
            </div>

            <div
                class="mt-6 p-4 bg-slate-800/80 rounded-xl border border-blue-500/30"
            >
                <p class="text-center text-blue-200 text-sm">
                    {$t("info.deckNote")}
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div
            class="p-4 border-t border-slate-700 flex justify-end bg-slate-800/50"
        >
            <button
                class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold shadow-lg transition-all transform hover:scale-105"
                onclick={onClose}
            >
                OK
            </button>
        </div>
    </div>
</div>
