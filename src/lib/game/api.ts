import { Agent } from '@atproto/api';
import type { UserCard, PostCard } from './types';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';
import { GAME_CONFIG } from './config';

export type ProgressKey = 'loadingLikes' | 'loadingBuildDeck' | 'loadingAnalysis';

export async function fetchGameDecks(
  ag: Agent,
  actor: string,
  onProgress?: (key: ProgressKey) => void
): Promise<{ avatarDeck: UserCard[], contentDeck: PostCard[] }> {

  onProgress?.('loadingLikes');

  // --- 1. Fetch "My Likes" (Depth 1) ---
  const myLikes = await fetchAuthorLikes(ag, actor, GAME_CONFIG.deck.avatarCount); // Fetch enough to find authors
  const myLikedAuthors = Array.from(myLikes.authors);

  // --- 2. Fetch "Extended Likes" (Depth 2) ---
  // Select random authors from my likes to fetch their likes
  const extendedLikesUris: string[] = [];
  const extendedAuthors = new Set<string>();

  if (myLikedAuthors.length > 0) {
    // Pick random 5 authors
    const shuffledAuthors = myLikedAuthors.sort(() => Math.random() - 0.5).slice(0, 5);

    for (const targetUser of shuffledAuthors) {
      try {
        // Fetch a smaller batch from each extended user to get variety
        const extendedRes = await fetchAuthorLikes(ag, targetUser, 5);
        // console.log(`Fetched likes for extended user ${targetUser}`, extendedRes);
        extendedRes.uris.forEach(u => extendedLikesUris.push(u));
        extendedRes.authors.forEach(a => extendedAuthors.add(a));
      } catch (e) {
        console.warn(`Failed to fetch likes for extended user ${targetUser}`, e);
      }
    }
  }

  // --- 3. Mix & Build Content Deck ---
  onProgress?.('loadingBuildDeck');

  const halfDeckSize = Math.floor(GAME_CONFIG.deck.contentCount / 2);

  // Shuffle pools
  const pool1 = myLikes.uris.sort(() => Math.random() - 0.5);
  const pool2 = extendedLikesUris.sort(() => Math.random() - 0.5);
  // console.log(pool1, pool2);

  // Take 50% from each (or fill from other if one is empty)
  // If pool2 is empty, pool1 takes all.
  const take1 = pool2.length > 0 ? halfDeckSize : GAME_CONFIG.deck.contentCount;
  const take2 = GAME_CONFIG.deck.contentCount - take1;

  const selectedUris = [
    ...pool1.slice(0, take1),
    ...pool2.slice(0, take2)
  ];

  // Fill up if we are short
  if (selectedUris.length < GAME_CONFIG.deck.contentCount) {
    const remainingNeeded = GAME_CONFIG.deck.contentCount - selectedUris.length;
    // Try to take more from pool1 if available (excluding what we already took)
    const moreFrom1 = pool1.slice(take1, take1 + remainingNeeded);
    selectedUris.push(...moreFrom1);
  }

  // Hydrate Posts
  const allLikes: any[] = [];
  const uniqueUrisToHydrate = [...new Set(selectedUris)];
  // Should roughly be contentCount, maybe less if dups.

  const chunkSize = 25;
  for (let i = 0; i < uniqueUrisToHydrate.length; i += chunkSize) {
    const chunk = uniqueUrisToHydrate.slice(i, i + chunkSize);
    try {
      const postsRes = await ag.getPosts({ uris: chunk });
      const posts = postsRes.data.posts;
      allLikes.push(...posts.map(p => ({ post: p })));
    } catch (e) {
      console.warn(`Failed to fetch posts chunk ${i}`, e);
    }
  }

  const contentDeck = buildContentDeck(allLikes);


  // --- 4. Mix & Build Avatar Deck ---
  onProgress?.('loadingAnalysis');

  const halfAvatarCount = Math.floor(GAME_CONFIG.deck.avatarCount / 2);

  // Candidates
  // pool1Authors is myLikedAuthors
  // pool2Authors is Array.from(extendedAuthors)

  // Filter out myself from candidates if present? user cards usually ok.

  const pool1Authors = myLikedAuthors.sort(() => Math.random() - 0.5);
  const pool2Authors = Array.from(extendedAuthors).sort(() => Math.random() - 0.5);

  const takeAv1 = pool2Authors.length > 0 ? halfAvatarCount : GAME_CONFIG.deck.avatarCount;
  const takeAv2 = GAME_CONFIG.deck.avatarCount - takeAv1;

  let avatarCandidatesRaw = [
    ...pool1Authors.slice(0, takeAv1),
    ...pool2Authors.slice(0, takeAv2)
  ];

  // Fill up logic
  if (avatarCandidatesRaw.length < GAME_CONFIG.deck.avatarCount) {
    const remaining = GAME_CONFIG.deck.avatarCount - avatarCandidatesRaw.length;
    const moreFrom1 = pool1Authors.slice(takeAv1, takeAv1 + remaining);
    avatarCandidatesRaw.push(...moreFrom1);
  }

  // Map to object structure for buildAvatarDeck
  let avatarCandidates = avatarCandidatesRaw.map(did => ({ did }));

  // Fallback to follows if we are STILL short (e.g. very new user, no extended network)
  if (avatarCandidates.length < GAME_CONFIG.deck.avatarCount) {
    try {
      const followsRes = await ag.getFollows({ actor: actor, limit: 100 });
      const newFollows = followsRes.data.follows
        .filter(f => !avatarCandidatesRaw.includes(f.did))
        .map(f => ({ did: f.did }));
      avatarCandidates.push(...newFollows);
    } catch (e) {
      console.warn("Failed to fetch follows for fallback", e);
    }
  }

  const avatarDeck = await buildAvatarDeck(ag, avatarCandidates);

  return { avatarDeck, contentDeck };
}

async function fetchAuthorLikes(
  baseAgent: Agent,
  actor: string,
  limit: number
): Promise<{ uris: string[], authors: Set<string> }> {

  const authors = new Set<string>();
  const uris: string[] = [];

  let repoAgent = baseAgent;
  try {
    const endpoint = await getPdsEndpoint(actor);
    if (endpoint) {
      repoAgent = new Agent(endpoint);
    }
  } catch (e) {
    // console.warn(`Failed to resolve PDS for ${actor}, using default`, e);
  }

  let cursor: string | undefined;
  let count = 0;

  // Limit max loops to avoid infinite hanging if something is weird
  // If limit is 100, we need 1 loop (100 items). 
  // We'll loop until we hit 'limit' number of items or run out.

  try {
    while (count < limit) {
      const res = await repoAgent.com.atproto.repo.listRecords({
        repo: actor,
        collection: 'app.bsky.feed.like',
        limit: 100, // Max page size
        cursor
      });

      const records = res.data.records;
      if (!records || records.length === 0) break;

      for (const record of records) {
        // @ts-ignore
        const subjectUri = record.value.subject?.uri;
        if (subjectUri && typeof subjectUri === 'string') {
          uris.push(subjectUri);
          count++;

          const match = subjectUri.match(/^at:\/\/([^\/]+)/);
          if (match && match[1]) {
            authors.add(match[1]);
          }
        }
      }

      cursor = res.data.cursor;
      if (!cursor) break;
    }
  } catch (e) {
    console.warn(`Error fetching likes for ${actor}`, e);
  }

  return { uris, authors };
}

function buildContentDeck(likes: any[]): PostCard[] {
  // Shuffle loves availability
  const shuffled = likes.sort(() => Math.random() - 0.5);
  const validLikes = shuffled.slice(0, GAME_CONFIG.deck.contentCount);

  return validLikes.map(item => {
    const post = item.post;
    const likeCount = post.likeCount || 0;
    const textLen = (post.record as any).text?.length || 0;

    // Image check
    let imageUrl = undefined;
    if (post.embed?.images?.length > 0) {
      imageUrl = post.embed.images[0].fullsize;
    } else if (post.embed?.media?.images?.length > 0) {
      imageUrl = post.embed.media.images[0].fullsize;
    }

    // Power
    // Cost
    let power = Math.floor((100 * likeCount ^ 0.4) / (textLen + 10));
    let cost = Math.floor(1 + (textLen / 40));

    // Increase cost for image posts
    if (imageUrl) {
      cost += 2;
    }

    // Clamp
    if (cost < 1) cost = 1;
    if (power < 10) power = 10;

    return {
      id: post.uri,
      uuid: crypto.randomUUID(),
      type: 'post',
      handle: post.author.handle,
      displayName: post.author.displayName,
      text: (post.record as any).text,
      imageUrl,
      power,
      cost,
      originalLikes: likeCount
    };
  });
}

async function buildAvatarDeck(ag: Agent, candidates: any[]): Promise<UserCard[]> {
  // We need to fetch profiles for these candidates since we only have DIDs (mostly)
  const selectedAuthors = candidates.sort(() => Math.random() - 0.5).slice(0, GAME_CONFIG.deck.avatarCount);

  if (selectedAuthors.length === 0) return [];

  let profilesMap = new Map<string, any>();

  // Chunk into 25s
  const chunkSize = 25;
  for (let i = 0; i < selectedAuthors.length; i += chunkSize) {
    const chunk = selectedAuthors.slice(i, i + chunkSize);
    const dids = chunk.map(a => a.did);

    try {
      const profileRes = await ag.getProfiles({ actors: dids });
      profileRes.data.profiles.forEach(p => profilesMap.set(p.did, p));
    } catch (e) {
      console.warn(`Failed to batch fetch profiles (chunk ${i})`, e);
    }
  }

  // Filter out any that failed to fetch profile (optional, but safer)
  // modify map to return Card
  const deck: UserCard[] = [];

  for (const f of selectedAuthors) {
    const profile = profilesMap.get(f.did);
    if (!profile) continue; // Skip if profile fetch failed

    const followers = profile.followersCount || 0;
    const follows = profile.followsCount || 0;

    // Power
    let power = Math.floor(20 * Math.log10(followers + 1) + Math.sqrt(followers));
    if (power < 1) power = 1;

    // Cost
    const discount = followers > follows * 10 ? -2 : 0;
    const penalty = follows > followers ? 2 : 0;
    let rawCost = Math.floor(Math.log10(followers + 1) + discount + penalty);
    let cost = Math.max(1, Math.min(10, rawCost));

    deck.push({
      id: f.did,
      uuid: crypto.randomUUID(),
      type: 'user',
      handle: profile.handle,
      displayName: profile.displayName || profile.handle,
      avatarUrl: profile.avatar,
      description: profile.description,
      power,
      cost
    });
  }

  return deck;
}
