<script lang="ts">
  import { locale, t } from "$lib/i18n";

  let { isOpen, onClose, did, handle } = $props<{
    isOpen: boolean;
    onClose: () => void;
    did: string;
    handle: string;
  }>();

  function toggleLocale() {
    locale.update((l) => (l === "en" ? "jp" : "en"));
  }

  function handleLogout() {
    localStorage.removeItem("bsky_handle");
    location.reload();
  }
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
  >
    <!-- Modal -->
    <div
      class="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-6 relative animate-in zoom-in-95 duration-200"
    >
      <!-- Close Button -->
      <button
        class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        onclick={onClose}
        aria-label={$t("close")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <h2 class="text-2xl font-bold text-white">{$t("settings")}</h2>

      <!-- Language Switcher -->
      <div class="flex flex-col gap-2">
        <span class="text-sm text-slate-400 uppercase font-bold tracking-wider"
          >{$t("language")}</span
        >
        <div class="flex gap-2">
          <button
            class="flex-1 py-2 rounded-lg border font-bold transition-all {$locale ===
            'jp'
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
              : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}"
            onclick={() => locale.set("jp")}
          >
            日本語
          </button>
          <button
            class="flex-1 py-2 rounded-lg border font-bold transition-all {$locale ===
            'en'
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
              : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}"
            onclick={() => locale.set("en")}
          >
            English
          </button>
        </div>
      </div>

      <hr class="border-slate-700" />

      <!-- Sign Out -->
      {#if did}
        <button
          class="w-full py-3 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          onclick={handleLogout}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline
              points="16 17 21 12 16 7"
            ></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg
          >
          {$t("signOut")} @{handle}
        </button>
      {/if}
    </div>
  </div>
{/if}
