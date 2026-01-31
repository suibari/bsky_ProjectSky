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

  const uniqueAuthorDids = new Set<string>();
  const likedPostUris: string[] = [];

  let cursor: string | undefined;
  let loopCount = 0;

  // 1. Resolve PDS Endpoint & Create Agent for Repo operations
  let repoAgent = ag;
  try {
    const endpoint = await getPdsEndpoint(actor);
    if (endpoint) {
      repoAgent = new Agent(endpoint);
    }
  } catch (e) {
    console.warn("Failed to resolve PDS endpoint, falling back to public agent", e);
  }

  // 2. Fetch Likes using listRecords (Targeting PDS)
  // Ensure we get enough unique authors and enough posts
  // We want ideally 100 User Cards (unique authors)
  while ((uniqueAuthorDids.size < GAME_CONFIG.deck.avatarCount || likedPostUris.length < GAME_CONFIG.deck.contentCount) && loopCount < 10) {
    loopCount++;
    try {
      const res = await repoAgent.com.atproto.repo.listRecords({
        repo: actor,
        collection: 'app.bsky.feed.like',
        limit: 100,
        cursor
      });

      const records = res.data.records;
      if (!records || records.length === 0) break;

      for (const record of records) {
        // @ts-ignore
        const subjectUri = record.value.subject?.uri;
        if (subjectUri && typeof subjectUri === 'string') {
          likedPostUris.push(subjectUri);

          // Extract DID from URI: at://did:plc:xyz/...
          // The format is at://<did>/<collection>/<rkey>
          const match = subjectUri.match(/^at:\/\/([^\/]+)/);
          if (match && match[1]) {
            uniqueAuthorDids.add(match[1]);
          }
        }
      }

      cursor = res.data.cursor;
      if (!cursor) break;

    } catch (e) {
      console.warn("Error fetching likes records", e);
      break;
    }
  }

  // 3. Hydrate Posts using getPosts (Batch fetch) for Content Deck
  onProgress?.('loadingBuildDeck');

  const allLikes: any[] = [];
  // Use Set to dedup URIs just in case
  const uniqueUris = [...new Set(likedPostUris)];
  const chunkSize = 25;

  // Only hydrate enough posts for the deck. 
  // If we fetched 1000 likes to find 100 authors, we don't need to hydrate all 1000.
  // We just need GAME_CONFIG.deck.contentCount (100).
  const postsToFetch = uniqueUris.slice(0, GAME_CONFIG.deck.contentCount + 10); // +10 buffer

  for (let i = 0; i < postsToFetch.length; i += chunkSize) {
    const chunk = postsToFetch.slice(i, i + chunkSize);
    try {
      const postsRes = await ag.getPosts({ uris: chunk });
      const posts = postsRes.data.posts;
      allLikes.push(...posts.map(p => ({ post: p })));
    } catch (e) {
      console.warn(`Failed to fetch posts chunk ${i}`, e);
    }
  }

  const contentDeck = buildContentDeck(allLikes);

  // 4. Build Avatar Deck from Unique Authors found
  onProgress?.('loadingAnalysis');

  // Convert collected DIDs to candidate objects
  // We need to fetch their profiles to get handle, avatar, etc.
  let avatarCandidates = Array.from(uniqueAuthorDids).map(did => ({ did }));

  // If we still don't have enough unique authors from likes, fall back to "follows"
  // This addresses the issue where a user only likes posts from a few people.
  if (avatarCandidates.length < GAME_CONFIG.deck.avatarCount) {
    try {
      // Fetch user's follows to fill the gap
      // We can fetch up to 100 to fill checks
      const followsRes = await ag.getFollows({ actor: actor, limit: 100 });
      const newFollows = followsRes.data.follows
        .filter(f => !uniqueAuthorDids.has(f.did))
        .map(f => ({ did: f.did }));

      avatarCandidates.push(...newFollows);
    } catch (e) {
      console.warn("Failed to fetch follows for fallback", e);
    }
  }

  // Slice to limit before fetching profiles to save requests?
  // Actually buildAvatarDeck handles slicing.
  const avatarDeck = await buildAvatarDeck(ag, avatarCandidates);

  return { avatarDeck, contentDeck };
}

function buildContentDeck(likes: any[]): PostCard[] {
  // Shuffle loves availability
  const shuffled = likes.sort(() => Math.random() - 0.5);
  const validLikes = shuffled.slice(0, GAME_CONFIG.deck.contentCount);

  return validLikes.map(item => {
    const post = item.post;
    const likeCount = post.likeCount || 0;
    const textLen = (post.record as any).text?.length || 0;

    // Power
    // Cost
    let power = Math.floor((100 * likeCount ^ 0.4) / (textLen + 10));
    let cost = Math.floor(1 + (textLen / 40));

    // Clamp
    if (cost < 1) cost = 1;
    if (power < 10) power = 10;

    // Image check
    let imageUrl = undefined;
    if (post.embed?.images?.length > 0) {
      imageUrl = post.embed.images[0].fullsize;
    } else if (post.embed?.media?.images?.length > 0) {
      imageUrl = post.embed.media.images[0].fullsize;
    }

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
