<script lang="ts">
  import GameClear from "$lib/components/visuals/GameClear.svelte";
  import type { MvpCards } from "$lib/game/types";

  const mockUserCard = {
    id: "user1",
    type: "user" as const,
    handle: "debug_user.bsky.social",
    displayName: "Debug User",
    avatarUrl:
      "https://bsky.social/xrpc/com.atproto.sync.getBlob?did=did:plc:ragtjsm2j2vknwkz3zp4oxrd&cid=bafkreihqj36b7p2k6k6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q6", // Example PDS blob or use a placeholder
    // Using a reliable placeholder for testing if needed, or rely on proxy handling failure gracefully
    description: "Bio",
    power: 1234,
    cost: 10,
    originalPower: 1234,
    uuid: "uuid-1", // Added uuid
  };

  const mockPostCard = {
    id: "post1",
    type: "post" as const,
    text: "This is a debug post text to check alignment and wrapping. It should look good on the card.",
    handle: "post_author.bsky.social",
    displayName: "Post Author",
    avatarUrl: "",
    imageUrl: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba", // Random Unsplash
    power: 5678,
    cost: 5,
    originalPower: 5678,
    playedScore: 5678,
    uuid: "uuid-2", // Added uuid
    originalLikes: 100, // Added originalLikes
  };

  const mvpCards: MvpCards = {
    user: mockUserCard,
    post: mockPostCard,
  };
</script>

<div class="w-full h-dvh bg-slate-900 flex items-center justify-center">
  <GameClear score={12345} rank="SS" {mvpCards} />
</div>
