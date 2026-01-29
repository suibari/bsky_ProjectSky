import { Agent } from '@atproto/api';
import type { UserCard, PostCard } from './types';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';

export type ProgressKey = 'loadingLikes' | 'loadingBuildDeck' | 'loadingAnalysis';

export async function fetchGameDecks(
  ag: Agent,
  actor: string,
  onProgress?: (key: ProgressKey) => void
): Promise<{ avatarDeck: UserCard[], contentDeck: PostCard[] }> {

  onProgress?.('loadingLikes');

  const collectedAuthors = new Map<string, any>();
  const allLikes: any[] = [];

  let cursor: string | undefined;
  let loopCount = 0;

  while (collectedAuthors.size < 25 && loopCount < 10) {
    loopCount++;
    try {
      const res = await ag.getActorLikes({
        actor,
        limit: 100,
        cursor
      });

      const feed = res.data.feed;
      if (!feed || feed.length === 0) break;

      allLikes.push(...feed);

      for (const item of feed) {
        const author = item.post.author;
        if (author.did !== actor && !collectedAuthors.has(author.did)) {
          collectedAuthors.set(author.did, author);
        }
      }

      cursor = res.data.cursor;
      if (!cursor) break;

    } catch (e) {
      console.warn("Error fetching likes page", e);
      break;
    }
  }

  onProgress?.('loadingBuildDeck');
  const contentDeck = buildContentDeck(allLikes);

  onProgress?.('loadingAnalysis');
  const avatarCandidates = Array.from(collectedAuthors.values());
  const avatarDeck = await buildAvatarDeck(ag, avatarCandidates);

  return { avatarDeck, contentDeck };
}

function buildContentDeck(likes: any[]): PostCard[] {
  const validLikes = likes.slice(0, 100);

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
  const selectedAuthors = candidates.sort(() => Math.random() - 0.5).slice(0, 30); // Aim for 30

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
