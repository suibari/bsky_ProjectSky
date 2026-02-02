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

  // --- 1. Fetch "My Likes" (Condition A - Direct) ---
  // Fetch more than needed to ensure we have a pool
  const myLikesRes = await fetchAuthorLikes(ag, actor, GAME_CONFIG.deck.avatarCount * 2);
  const myLikesUris = myLikesRes.uris;
  const myLikedAuthors = Array.from(myLikesRes.authors);

  // --- 2. Fetch "Extended Likes" (Condition B - Extended) ---
  const extendedLikesUris: string[] = [];
  const extendedAuthors = new Set<string>();

  if (myLikedAuthors.length > 0) {
    // Pick random authors
    const shuffledAuthors = myLikedAuthors.sort(() => Math.random() - 0.5).slice(0, 5);

    for (const targetUser of shuffledAuthors) {
      try {
        const extendedRes = await fetchAuthorLikes(ag, targetUser, 10);
        extendedRes.uris.forEach(u => extendedLikesUris.push(u));
        extendedRes.authors.forEach(a => extendedAuthors.add(a));
      } catch (e) {
        console.warn(`Failed to fetch likes for extended user ${targetUser}`, e);
      }
    }
  }

  // --- 3. Build Content Deck (Posts) ---
  onProgress?.('loadingBuildDeck');

  // Pools
  // Pool A: My Likes
  const poolPostA = myLikesUris.sort(() => Math.random() - 0.5);
  // Pool B: Extended Likes (Exclude my likes)
  const myLikesSet = new Set(myLikesUris);
  const poolPostB = extendedLikesUris
    .filter(uri => !myLikesSet.has(uri))
    .sort(() => Math.random() - 0.5);

  // Enforce 50/50 Split with BUFFER
  // We want to fetch MORE than needed to account for deleted posts (hydration failures)
  // But we still need to respect the available pool size.
  const targetHalfPost = Math.floor(GAME_CONFIG.deck.contentCount / 2);
  const BUFFER_RATIO = 1.5;
  const bufferTarget = Math.ceil(targetHalfPost * BUFFER_RATIO);

  // Available in pools
  const availableA = poolPostA.length;
  const availableB = poolPostB.length;

  // We take up to bufferTarget from each, but we can't take more than available.
  // We don't limit by Min(A, B) yet, we try to get as many candidates as possible up to the buffer.
  const candidatesA = poolPostA.slice(0, bufferTarget).map(uri => ({ uri, origin: 'direct' as const }));
  const candidatesB = poolPostB.slice(0, bufferTarget).map(uri => ({ uri, origin: 'extended' as const }));

  const combinedCandidatesPost = [...candidatesA, ...candidatesB]; // Not shuffled heavily yet, we can shuffle after hydration? Or shuffle now for batching?
  // Batching doesn't care about order.

  console.log(`[DeckBuild] Post Candidates (Buffer ${BUFFER_RATIO}x): A=${candidatesA.length}/${availableA}, B=${candidatesB.length}/${availableB}`);

  // Hydrate Post Cards
  const allPostItems: { post: any, origin: 'direct' | 'extended' }[] = [];
  const uniqueUrisToHydrate = [...new Set(combinedCandidatesPost.map(x => x.uri))];

  // Map URI back to origin
  const uriOriginMap = new Map<string, 'direct' | 'extended'>();
  combinedCandidatesPost.forEach(x => uriOriginMap.set(x.uri, x.origin));

  const chunkSize = 25;
  for (let i = 0; i < uniqueUrisToHydrate.length; i += chunkSize) {
    const chunk = uniqueUrisToHydrate.slice(i, i + chunkSize);
    try {
      const postsRes = await ag.getPosts({ uris: chunk });
      const posts = postsRes.data.posts;
      posts.forEach(p => {
        const origin = uriOriginMap.get(p.uri) || 'direct';
        allPostItems.push({ post: p, origin });
      });
    } catch (e) {
      console.warn(`Failed to fetch posts chunk ${i}`, e);
    }
  }

  // Filter & Select Final Deck (After Hydration check)
  // Split back into A and B
  const validPostA = allPostItems.filter(p => p.origin === 'direct');
  const validPostB = allPostItems.filter(p => p.origin === 'extended');

  // New Min Check
  const finalPairsCount = Math.min(validPostA.length, validPostB.length, targetHalfPost);

  const finalPostA = validPostA.slice(0, finalPairsCount);
  const finalPostB = validPostB.slice(0, finalPairsCount);

  const finalDeckItems = [...finalPostA, ...finalPostB].sort(() => Math.random() - 0.5);

  const contentDeck = buildContentDeck(finalDeckItems);
  console.log(`[DeckBuild] Post Deck Final: A=${finalPostA.length}, B=${finalPostB.length}, Total=${contentDeck.length} (Target: ${GAME_CONFIG.deck.contentCount})`);

  // --- 4. Build Avatar Deck (Users) ---
  onProgress?.('loadingAnalysis');

  // Pool A: My Liked Authors
  const poolUserA = myLikedAuthors.sort(() => Math.random() - 0.5);
  // Pool B: Extended Authors (Exclude my liked authors)
  const myLikedAuthorsSet = new Set(myLikedAuthors);
  const poolUserB = Array.from(extendedAuthors)
    .filter(did => !myLikedAuthorsSet.has(did))
    .sort(() => Math.random() - 0.5);

  // Buffer Selection for Users
  const targetHalfUser = Math.floor(GAME_CONFIG.deck.avatarCount / 2);
  const bufferTargetUser = Math.ceil(targetHalfUser * BUFFER_RATIO);

  // Available
  const availUserA = poolUserA.length;
  const availUserB = poolUserB.length;

  const userCandidatesA = poolUserA.slice(0, bufferTargetUser).map(did => ({ did, origin: 'direct' as const }));
  const userCandidatesB = poolUserB.slice(0, bufferTargetUser).map(did => ({ did, origin: 'extended' as const }));

  console.log(`[DeckBuild] User Candidates (Buffer ${BUFFER_RATIO}x): A=${userCandidatesA.length}/${availUserA}, B=${userCandidatesB.length}/${availUserB}`);

  const combinedCandidatesUser = [...userCandidatesA, ...userCandidatesB];

  // Hydrate Users
  // We need to hydrate manually here instead of calling buildAvatarDeck immediately to filter failures.
  const allUserItems: { profile: any, origin: 'direct' | 'extended' }[] = [];
  const didsToFetch = combinedCandidatesUser.map(c => c.did);
  const didOriginMap = new Map<string, 'direct' | 'extended'>();
  combinedCandidatesUser.forEach(c => didOriginMap.set(c.did, c.origin));

  // Chunk fetch profiles
  for (let i = 0; i < didsToFetch.length; i += chunkSize) {
    const chunk = didsToFetch.slice(i, i + chunkSize);
    try {
      const profileRes = await ag.getProfiles({ actors: chunk });
      profileRes.data.profiles.forEach(p => {
        const origin = didOriginMap.get(p.did) || 'direct';
        allUserItems.push({ profile: p, origin });
      });
    } catch (e) {
      console.warn(`Failed to batch fetch profiles (chunk ${i})`, e);
    }
  }

  // Filter & Select Final User Deck
  const validUserA = allUserItems.filter(p => p.origin === 'direct');
  const validUserB = allUserItems.filter(p => p.origin === 'extended');

  const finalUserPairs = Math.min(validUserA.length, validUserB.length, targetHalfUser);

  const finalUserA = validUserA.slice(0, finalUserPairs);
  const finalUserB = validUserB.slice(0, finalUserPairs);

  const finalUserDeckItems = [...finalUserA, ...finalUserB].sort(() => Math.random() - 0.5);

  // Transform to Card (similar to buildAvatarDeck but using already fetched profiles)
  const avatarDeck: UserCard[] = [];
  for (const item of finalUserDeckItems) {
    const profile = item.profile;
    const origin = item.origin;

    const followers = profile.followersCount || 0;
    const follows = profile.followsCount || 0;

    let basePower = Math.floor(20 * Math.log10(followers + 1) + Math.sqrt(followers));
    const multiplier = origin === 'direct' ? 0.7 : 1.5;
    let power = Math.floor(basePower * multiplier);
    if (power < 1) power = 1;

    const discount = followers > follows * 10 ? -2 : 0;
    const penalty = follows > followers ? 2 : 0;
    let rawCost = Math.floor(Math.log10(followers + 1) + discount + penalty);
    let cost = Math.max(1, Math.min(10, rawCost));

    avatarDeck.push({
      id: profile.did,
      uuid: crypto.randomUUID(),
      type: 'user',
      handle: profile.handle,
      displayName: profile.displayName || profile.handle,
      avatarUrl: profile.avatar,
      description: profile.description,
      power,
      cost,
      origin
    });
  }

  console.log(`[DeckBuild] User Deck Final: A=${finalUserA.length}, B=${finalUserB.length}, Total=${avatarDeck.length} (Target: ${GAME_CONFIG.deck.avatarCount})`);


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

function buildContentDeck(items: { post: any, origin: 'direct' | 'extended' }[]): PostCard[] {
  return items.map(item => {
    const post = item.post;
    const origin = item.origin;
    const likeCount = post.likeCount || 0;
    const textLen = (post.record as any).text?.length || 0;

    // Image check
    let imageUrl = undefined;
    if (post.embed?.images?.length > 0) {
      imageUrl = post.embed.images[0].fullsize;
    } else if (post.embed?.media?.images?.length > 0) {
      imageUrl = post.embed.media.images[0].fullsize;
    }

    // Power Calculation
    // Base Power
    let basePower = Math.floor((100 * likeCount ^ 0.4) / (textLen + 10));

    // Apply Multiplier
    // A (Direct): 0.7x
    // B (Extended): 1.5x
    let multiplier = origin === 'direct' ? 0.7 : 1.5;
    let power = Math.floor(basePower * multiplier);

    // Cost
    let cost = Math.floor(1 + (textLen / 40) + Math.sqrt(likeCount) / 10);
    if (imageUrl) {
      cost += 2;
    }

    // Clamp
    if (cost < 1) cost = 1;
    if (GAME_CONFIG.pds.initialCapacity + GAME_CONFIG.maxTurns * GAME_CONFIG.pds.maxCapacityIncrement < cost) {
      cost = GAME_CONFIG.pds.initialCapacity + GAME_CONFIG.maxTurns * GAME_CONFIG.pds.maxCapacityIncrement;
    } // Maximum cost
    if (power < 1) power = 1; // Minimum power 1 

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
      originalLikes: likeCount,
      origin
    };
  });
}

async function buildAvatarDeck(ag: Agent, candidates: { did: string, origin: 'direct' | 'extended' }[]): Promise<UserCard[]> {
  if (candidates.length === 0) return [];

  let profilesMap = new Map<string, any>();
  const dids = candidates.map(c => c.did);

  // Chunk into 25s for profile fetch
  const chunkSize = 25;
  for (let i = 0; i < dids.length; i += chunkSize) {
    const chunk = dids.slice(i, i + chunkSize);
    try {
      const profileRes = await ag.getProfiles({ actors: chunk });
      profileRes.data.profiles.forEach(p => profilesMap.set(p.did, p));
    } catch (e) {
      console.warn(`Failed to batch fetch profiles (chunk ${i})`, e);
    }
  }

  const deck: UserCard[] = [];

  for (const candidate of candidates) {
    const profile = profilesMap.get(candidate.did);
    if (!profile) continue;

    const followers = profile.followersCount || 0;
    const follows = profile.followsCount || 0;

    // Power Calculation
    // Base Power
    let basePower = Math.floor(30 * Math.log10(followers + 1) + Math.sqrt(followers));

    // Apply Multiplier
    const multiplier = candidate.origin === 'direct' ? 0.7 : 1.5;
    let power = Math.floor(basePower * multiplier);

    if (power < 1) power = 1;

    // Cost
    const discount = followers > follows * 10 ? -2 : 0;
    const penalty = follows > followers ? 2 : 0;
    let rawCost = Math.floor(Math.log10(followers + 1) + discount + penalty);
    let cost = Math.max(1, Math.min(10, rawCost));

    deck.push({
      id: candidate.did,
      uuid: crypto.randomUUID(),
      type: 'user',
      handle: profile.handle,
      displayName: profile.displayName || profile.handle,
      avatarUrl: profile.avatar,
      description: profile.description,
      power,
      cost,
      origin: candidate.origin
    });
  }

  return deck;
}
