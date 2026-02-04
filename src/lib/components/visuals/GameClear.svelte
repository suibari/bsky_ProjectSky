<script lang="ts">
  import { onMount, tick } from "svelte";
  import { Confetti } from "svelte-confetti";
  import gsap from "gsap";
  import { t } from "$lib/i18n";
  import { formatScore } from "$lib/utils/format";
  import CardComponent from "../Card.svelte";
  import type { UserCard, PostCard, Card } from "../../game/types";
  import { trackShare, trackEvent } from "$lib/analytics";

  let { score, rank, mvpCards, player, allCards, onPlayAgain } = $props<{
    score: number;
    rank: string;
    mvpCards?: { user: UserCard | null; post: PostCard | null };
    player?: { displayName: string; handle: string; avatarUrl?: string };
    allCards?: Card[];
    onPlayAgain?: () => void;
  }>();

  let textElement: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let showShareModal = $state(false);
  let showDeckModal = $state(false);
  let shareImageUrl = $state("");

  let sortedDeck = $derived(
    [...(allCards || [])].sort((a, b) => {
      // 1. Sort by type (User first)
      if (a.type !== b.type) {
        return a.type === "user" ? -1 : 1;
      }
      // 2. Sort by power (descending)
      return b.originalPower - a.originalPower;
    }),
  );

  let shareText = $derived(
    $t("shareText" as any)
      .replace("{rank}", rank)
      .replace("{score}", score.toLocaleString()),
  );
  let shareIntentUrl = $derived(
    `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`,
  );

  onMount(() => {
    // Animate Text
    gsap.fromTo(
      textElement,
      { scale: 0.8, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        delay: 0.2,
      },
    );
  });

  async function openShareModal() {
    showShareModal = true;
    if (!shareImageUrl) {
      await tick();
      generateShareImage();
    }
  }

  async function generateShareImage() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#1e293b"; // Slate-800
    ctx.fillRect(0, 0, 1080, 1080);

    // Gradient Overlay
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
    gradient.addColorStop(0, "#1e1e2e"); // Darker blue
    gradient.addColorStop(1, "#0f172a"); // Slate-900
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);

    // Title: Project Sky
    ctx.font = "80px 'Dela Gothic One', sans-serif";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 20;
    ctx.fillText($t("titleMain" as any), 540, 80);

    // Ambassador
    if (player) {
      ctx.font = "bold 40px sans-serif";
      ctx.fillStyle = "#94a3b8"; // Slate-400
      const name = player.displayName || `@${player.handle}`;
      ctx.fillText(`Ambassador: ${name}`, 540, 180);
    }

    // Rank & Score
    ctx.font = "bold 60px sans-serif";
    ctx.fillStyle = "#cbd5e1"; // Slate-300
    ctx.fillText(`User Count: ${score.toLocaleString()}`, 540, 260);

    ctx.font = "black 120px sans-serif";

    // Rank Color Logic (Simplified)
    if (rank === "SS" || rank === "S")
      ctx.fillStyle = "#fbbf24"; // Amber
    else if (rank === "A" || rank === "B")
      ctx.fillStyle = "#f472b6"; // Pink
    else ctx.fillStyle = "#60a5fa"; // Blue

    ctx.fillText(`Rank ${rank}: ${$t(("rank" + rank) as any)}`, 540, 340);

    // Cards
    if (mvpCards) {
      const cardY = 480;
      const cardWidth = 350;
      const cardHeight = 520;

      // Draw User Card (Left)
      if (mvpCards.user) {
        const x = 150;

        // Label
        ctx.font = "bold 30px sans-serif";
        ctx.fillStyle = "#fbbf24"; // Yellow-400
        ctx.textAlign = "center";
        ctx.fillText($t("mvpUser"), x + cardWidth / 2, cardY - 40);

        // Card Base
        drawCardBase(ctx, x, cardY, cardWidth, cardHeight);

        // -- Content --
        // PDS (Top Right)
        ctx.textAlign = "right";
        ctx.fillStyle = "#64748b"; // Slate-500
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("PDS", x + cardWidth - 15, cardY + 30);
        ctx.fillStyle = "#ec4899"; // Pink-500
        ctx.font = "900 32px sans-serif";
        ctx.fillText(
          String(mvpCards.user.cost),
          x + cardWidth - 15,
          cardY + 60,
        );

        // Name (Top Left)
        ctx.textAlign = "left";
        ctx.fillStyle = "#1e293b"; // Slate-800
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(
          mvpCards.user.displayName || `@${mvpCards.user.handle}`,
          x + 15,
          cardY + 30,
          cardWidth - 80,
        );

        // Avatar (Center)
        const avatarSize = 280;
        const avatarX = x + (cardWidth - avatarSize) / 2;
        const avatarY = cardY + 120;

        // Avatar Placeholder/Image
        ctx.save();
        roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 10);
        ctx.clip();
        ctx.fillStyle = "#e2e8f0"; // Slate-200
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

        if (mvpCards.user.avatarUrl) {
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(mvpCards.user.avatarUrl)}`;
            const img = await loadImage(proxyUrl);
            ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
          } catch (e) {}
        } else {
          ctx.fillStyle = "#94a3b8";
          ctx.textAlign = "center";
          ctx.font = "bold 30px sans-serif";
          ctx.fillText(
            "No Image",
            avatarX + avatarSize / 2,
            avatarY + avatarSize / 2,
          );
        }
        ctx.restore();

        // Border around avatar
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 4;
        roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 10);
        ctx.stroke();

        // Power (Bottom Left)
        ctx.textAlign = "left";
        ctx.fillStyle = "#64748b"; // Slate-500
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("Power/Turn", x + 15, cardY + cardHeight - 85);
        ctx.fillStyle = "#2563eb"; // Blue-600
        ctx.font = "900 40px sans-serif";
        ctx.fillText(
          formatScore(mvpCards.user.playedScore ?? mvpCards.user.power),
          x + 15,
          cardY + cardHeight - 60,
        );
      }

      // Draw Post Card (Right)
      if (mvpCards.post) {
        const x = 1080 - 150 - cardWidth;

        // Label
        ctx.font = "bold 30px sans-serif";
        ctx.fillStyle = "#22d3ee"; // Cyan-400
        ctx.textAlign = "center";
        ctx.fillText($t("mvpPost"), x + cardWidth / 2, cardY - 40);

        // Card Base (Clip for image)
        ctx.save();
        roundRect(ctx, x, cardY, cardWidth, cardHeight, 15);
        ctx.clip();

        // Background Image
        if (mvpCards.post.imageUrl) {
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(mvpCards.post.imageUrl)}`;
            const img = await loadImage(proxyUrl);
            drawImageCover(ctx, img, x, cardY, cardWidth, cardHeight);

            // Overlay
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(x, cardY, cardWidth, cardHeight);
          } catch (e) {
            ctx.fillStyle = "white";
            ctx.fillRect(x, cardY, cardWidth, cardHeight);
          }
        } else {
          ctx.fillStyle = "white";
          ctx.fillRect(x, cardY, cardWidth, cardHeight);
        }

        ctx.restore();

        // Border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 2;
        roundRect(ctx, x, cardY, cardWidth, cardHeight, 15);
        ctx.stroke();

        // PDS (Top Right)
        ctx.textAlign = "right";
        ctx.fillStyle = "#64748b"; // Slate-500
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("PDS", x + cardWidth - 15, cardY + 30);
        ctx.fillStyle = "#ec4899"; // Pink-500
        ctx.font = "900 32px sans-serif";
        ctx.fillText(
          String(mvpCards.post.cost),
          x + cardWidth - 15,
          cardY + 60,
        );

        // Content
        const hasImage = !!mvpCards.post.imageUrl;
        const textColor = hasImage ? "white" : "#0f172a";
        const powerLabelColor = hasImage
          ? "rgba(147, 197, 253, 0.8)"
          : "rgba(37, 99, 235, 0.8)"; // Blue-300 / Blue-600 0.8 opacity
        const powerValueColor = hasImage ? "#93c5fd" : "#2563eb"; // Blue-300 / Blue-600

        // Text (Center-ish)
        ctx.fillStyle = textColor;
        ctx.font = "italic 24px serif";
        ctx.textAlign = "center";
        wrapText(
          ctx,
          `"${mvpCards.post.text}"`,
          x + cardWidth / 2,
          cardY + 160,
          cardWidth - 40,
          32,
        );

        // Name (Below Text, Right Aligned)
        ctx.font = "bold 16px serif";
        ctx.textAlign = "right";
        ctx.fillText(
          `-- ${mvpCards.post.displayName || "@" + mvpCards.post.handle}`,
          x + cardWidth - 20,
          cardY + cardHeight - 140,
        );

        // Power
        ctx.textAlign = "left";
        ctx.fillStyle = powerLabelColor;
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("Power (Instant)", x + 15, cardY + cardHeight - 85);

        ctx.fillStyle = powerValueColor;
        ctx.font = "900 40px sans-serif";
        ctx.fillText(
          formatScore(mvpCards.post.playedScore ?? mvpCards.post.power),
          x + 15,
          cardY + cardHeight - 60,
        );
      }
    }

    // Watermark
    ctx.textAlign = "center";
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Generated by Project Sky", 540, 1050);

    shareImageUrl = canvas.toDataURL("image/png");
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function drawCardBase(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.save();
    // Card Shadow
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 10;

    // Card Base
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    roundRect(ctx, x, y, w, h, 15);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function saveRestore(ctx: CanvasRenderingContext2D, fn: () => void) {
    ctx.save();
    fn();
    ctx.restore();
  }

  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ) {
    const words = text.split(""); // Splitting by char for Japanese logic if needed, but lets simplify to words or basic splitting
    // Actually for Japanese and mixed, char splitting is safer if we manually measure
    // But simplistic space split for now might be enough if English, but probably not.
    // Let's do char based.

    let line = "";

    // Very basic simple wrap
    for (let n = 0; n < text.length; n++) {
      const testLine = line + text[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = text[n];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  function drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = img.width;
    let sourceHeight = img.height;

    // sourceWidth / sourceHeight > targetRatio
    // If image is wider than target (relative to height), clip width
    if (imgRatio > targetRatio) {
      sourceWidth = img.height * targetRatio;
      sourceX = (img.width - sourceWidth) / 2;
    } else {
      // Image is taller than target, clip height
      sourceHeight = img.width / targetRatio;
      sourceY = (img.height - sourceHeight) / 2;
    }

    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, x, y, w, h);
  }
</script>

<div
  class="fixed inset-0 z-[300] overflow-y-auto overflow-x-hidden pointer-events-auto touch-pan-y"
>
  <!-- Confetti Cannon -->
  {#if rank === "SS"}
    <div
      class="absolute -top-50 inset-0 flex h-full w-full pointer-events-none"
    >
      <Confetti
        x={[-5, 5]}
        y={[0, 0.1]}
        delay={[0, 5000]}
        infinite
        duration={5000}
        amount={200}
        fallDistance="100vh"
      />
    </div>
  {/if}

  <!-- Background Overlay -->
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm -z-10"></div>

  <!-- Text -->
  <div
    bind:this={textElement}
    class="relative z-10 flex flex-col items-center justify-start min-h-full py-16 px-4 md:p-8 text-center w-full max-w-5xl mx-auto"
  >
    <h1
      class="text-5xl md:text-9xl font-black text-white italic tracking-tighter mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] mt-8 md:mt-0"
    >
      {#if rank === "SS"}
        GAME CLEAR!!
      {:else}
        FINISH
      {/if}
    </h1>

    <div
      class="text-lg md:text-3xl text-gray-300 font-bold tracking-widest mb-8 md:mb-12 uppercase"
    >
      User Count: {score.toLocaleString()}
    </div>

    <!-- Rank Display -->
    <div
      class="text-6xl md:text-8xl font-black mb-2 md:mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
      class:text-amber-400={rank === "SS" || rank === "S"}
      class:text-pink-400={rank === "A" || rank === "B"}
      class:text-blue-400={rank === "C" || rank === "D" || rank === "E"}
      class:text-slate-400={rank === "F" || rank === "G"}
    >
      RANK {rank}
    </div>

    <!-- Rank Title -->
    <div
      class="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] mb-8 md:mb-16 tracking-tight"
    >
      {$t(("rank" + rank) as any)}
    </div>

    <!-- MVP Cards -->
    {#if mvpCards}
      <div
        class="flex flex-col md:flex-row gap-8 items-center justify-center mb-12 md:mb-16 w-full"
      >
        {#if mvpCards.user}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="flex flex-col items-center gap-2 cursor-pointer group"
            role="button"
            tabindex="0"
            onclick={() => {
              window.open(
                `https://bsky.app/profile/${mvpCards.user?.handle}`,
                "_blank",
              );
            }}
          >
            <div
              class="text-yellow-400 font-bold text-xl drop-shadow-md group-hover:text-yellow-300 transition-colors"
            >
              {$t("mvpUser")}
            </div>
            <div
              class="pointer-events-auto group-hover:scale-110 transition-transform duration-300 origin-center scale-90 md:scale-100"
            >
              <CardComponent
                card={mvpCards.user}
                interactive={false}
                displayPower={mvpCards.user.playedScore ?? mvpCards.user.power}
              />
            </div>
          </div>
        {/if}

        {#if mvpCards.post}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="flex flex-col items-center gap-2 cursor-pointer group"
            role="button"
            tabindex="0"
            onclick={() => {
              const rkey = mvpCards.post?.id.split("/").pop();
              window.open(
                `https://bsky.app/profile/${mvpCards.post?.handle}/post/${rkey}`,
                "_blank",
              );
            }}
          >
            <div
              class="text-cyan-400 font-bold text-xl drop-shadow-md group-hover:text-cyan-300 transition-colors"
            >
              {$t("mvpPost")}
            </div>
            <div
              class="pointer-events-auto group-hover:scale-110 transition-transform duration-300 origin-center scale-90 md:scale-100"
            >
              <CardComponent
                card={mvpCards.post}
                interactive={false}
                displayPower={mvpCards.post.playedScore ?? mvpCards.post.power}
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Buttons (In Flow) -->
    <div class="flex flex-col md:flex-row gap-4 mb-16 pointer-events-auto z-50">
      <button
        class="px-8 py-3 bg-blue-500 text-white font-bold rounded-full hover:scale-110 transition shadow-xl border-4 border-white w-64"
        onclick={openShareModal}
      >
        {$t("share")}
      </button>
      <button
        class="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-110 transition shadow-xl border-4 border-yellow-400 w-64"
        onclick={onPlayAgain}
      >
        {$t("playAgain")}
      </button>
      <button
        class="px-8 py-3 bg-slate-700 text-white font-bold rounded-full hover:scale-110 transition shadow-xl border-4 border-slate-500 w-64"
        onclick={() => {
          showDeckModal = true;
          trackEvent("view_deck_result");
        }}
      >
        {$t("deckCheck")}
      </button>
    </div>
  </div>

  <!-- Share Modal -->
  {#if showShareModal}
    <div
      class="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4 pointer-events-auto"
      onclick={() => (showShareModal = false)}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === "Escape" && (showShareModal = false)}
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-6"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="0"
      >
        <h2 class="text-xl font-bold text-white text-center">
          {$t("shareResult" as any) || "Share Result"}
        </h2>

        <div class="bg-gray-800 rounded-lg p-2 flex justify-center">
          {#if shareImageUrl}
            <img
              src={shareImageUrl}
              alt="Share Image"
              class="max-w-full rounded shadow-lg border border-slate-600"
            />
          {:else}
            <div class="text-gray-400 p-8">Generating image...</div>
          {/if}
        </div>

        <p class="text-sm text-gray-300 text-center">
          {$t("copyImageInstruction" as any) ||
            "Copy or save the image and paste it on Bluesky"}
        </p>

        <div class="flex gap-4 justify-center">
          <button
            class="px-6 py-2 bg-slate-700 text-white rounded-full font-bold hover:bg-slate-600 transition"
            onclick={() => (showShareModal = false)}
          >
            {$t("close" as any) || "Close"}
          </button>
          <a
            href={shareIntentUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="px-6 py-2 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-400 transition"
            onclick={() => trackShare(rank, score)}
          >
            Open Bluesky
          </a>
        </div>
      </div>
    </div>
  {/if}
  {#if showDeckModal}
    <div
      class="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4 pointer-events-auto"
      onclick={() => (showDeckModal = false)}
      role="button"
      tabindex="0"
      onkeydown={(e) => e.key === "Escape" && (showDeckModal = false)}
    >
      <div
        class="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-6xl h-[80vh] flex flex-col gap-6"
        onclick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabindex="0"
      >
        <div class="flex justify-between items-center shrink-0">
          <h2 class="text-2xl font-bold text-white">
            {$t("deckCheck") || "デッキ確認"} ({sortedDeck.length})
          </h2>
          <button
            class="text-slate-400 hover:text-white"
            onclick={() => (showDeckModal = false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-8 h-8"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="flex-grow overflow-y-auto p-4 bg-slate-950/50 rounded-xl">
          <div
            class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-4"
          >
            {#each sortedDeck as card (card.uuid)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="transform hover:scale-105 transition-transform duration-200 cursor-pointer"
                role="button"
                tabindex="0"
                onclick={(e) => {
                  e.stopPropagation();
                  if (card.type === "user") {
                    window.open(
                      `https://bsky.app/profile/${card.handle}`,
                      "_blank",
                    );
                  } else if (card.type === "post") {
                    const rkey = card.id.split("/").pop();
                    window.open(
                      `https://bsky.app/profile/${card.handle}/post/${rkey}`,
                      "_blank",
                    );
                  }
                }}
              >
                <!-- Mini Card Wrapper -->
                <div
                  class="w-full aspect-[2/3] relative flex items-center justify-center overflow-hidden"
                >
                  <div class="origin-center scale-75 transform">
                    <CardComponent
                      {card}
                      interactive={false}
                      displayPower={card.originalPower ?? card.power}
                    />
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Hidden Canvas for Image Generation -->
<canvas bind:this={canvas} width="1080" height="1080" class="hidden"></canvas>
