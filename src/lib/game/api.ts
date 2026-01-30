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

  const collectedAuthors = new Map<string, any>();
  const allLikes: any[] = [];
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
  while (likedPostUris.length < GAME_CONFIG.deck.avatarCount && loopCount < 10) {
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
        if (subjectUri) {
          likedPostUris.push(subjectUri);
        }
      }

      cursor = res.data.cursor;
      if (!cursor) break;

    } catch (e) {
      console.warn("Error fetching likes records", e);
      break;
    }
  }

  // 2. Hydrate Posts using getPosts (Batch fetch)
  onProgress?.('loadingBuildDeck');

  // Chunky fetch posts
  const uniqueUris = [...new Set(likedPostUris)];
  const chunkSize = 25;

  for (let i = 0; i < uniqueUris.length; i += chunkSize) {
    const chunk = uniqueUris.slice(i, i + chunkSize);
    try {
      const postsRes = await ag.getPosts({ uris: chunk });
      const posts = postsRes.data.posts;

      allLikes.push(...posts.map(p => ({ post: p }))); // Wrap to match expected format for buildContentDeck logic if needed, or just adapt logic.

      for (const post of posts) {
        const author = post.author;
        if (author.did !== actor && !collectedAuthors.has(author.did)) {
          collectedAuthors.set(author.did, author);
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch posts chunk ${i}`, e);
    }
  }

  const contentDeck = buildContentDeck(allLikes);

  onProgress?.('loadingAnalysis');
  const avatarCandidates = Array.from(collectedAuthors.values());
  const avatarDeck = await buildAvatarDeck(ag, avatarCandidates);

  return { avatarDeck, contentDeck };
}

function buildContentDeck(likes: any[]): PostCard[] {
  const validLikes = likes.slice(0, GAME_CONFIG.deck.contentCount);

  return validLikes.map(item => {
    const post = item.post;
    const likeCount = post.likeCount || 0;
    const textLen = (post.record as any).text?.length || 0;

    // New Formula: Power = (Likes * 1000) / (Length + 10)
    // Cost = 1 + Length/40
    let power = Math.floor((likeCount * 1000) / (textLen + 10));
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
      // Try fallback to individual fetch ? Too slow.
    }
  }

  return selectedAuthors.map(f => {
    const profile = profilesMap.get(f.did);
    const followers = profile?.followersCount || 0;
    const follows = profile?.followsCount || 0;

    // Power = sqrt(Followers)
    let power = Math.floor(Math.sqrt(followers));
    if (power < 1) power = 1;

    // Cost Formula: Clamp( floor( (Follows * 5) / (Followers + 1) ) + 1, 1, 10 )
    // High Follows / Low Followers = High Cost
    let rawCost = Math.floor((follows * 5) / (followers + 1)) + 1;
    let cost = Math.max(1, Math.min(10, rawCost));

    return {
      id: f.did,
      uuid: crypto.randomUUID(),
      type: 'user',
      handle: f.handle,
      displayName: f.displayName,
      avatarUrl: f.avatar,
      description: f.description,
      power,
      cost
    };
  });
}
