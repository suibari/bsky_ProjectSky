import { Agent } from '@atproto/api';
import type { AvatarCard, ContentCard } from './types';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';

/**
 * Valid progress keys for the UI loading state.
 * These should match keys in i18n.ts
 */
export type ProgressKey = 'loadingLikes' | 'loadingBuildDeck' | 'loadingAnalysis';

/**
 * Unified function to fetch data for both decks at once.
 * This avoids calling getActorLikes twice.
 */
export async function fetchGameDecks(
  ag: Agent,
  actor: string,
  onProgress?: (key: ProgressKey) => void
): Promise<{ avatarDeck: AvatarCard[], contentDeck: ContentCard[] }> {

  onProgress?.('loadingLikes');

  // 1. Fetch Likes (Candidate Collection)
  // We need enough likes to find ~25 unique authors for Avatars, 
  // and we'll use the same likes for Content cards.
  const collectedAuthors = new Map<string, any>(); // did -> profile/post.author
  const allLikes: any[] = [];

  let cursor: string | undefined;
  let loopCount = 0;

  // We loop until we have enough authors OR we hit a safety limit.
  // 10 pages * 100 items = 1000 likes max analysis.
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
        // Collect unique authors (exclude self)
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

  // 2. Build Content Deck
  // logic from original fetchContentDeck
  const contentDeck = buildContentDeck(allLikes);

  // 3. Build Avatar Deck
  // logic from original fetchAvatarDeck
  // We might switch to 'loadingAnalysis' for the heavy stats part
  onProgress?.('loadingAnalysis');

  const avatarCandidates = Array.from(collectedAuthors.values());
  const avatarDeck = await buildAvatarDeck(ag, avatarCandidates);

  return { avatarDeck, contentDeck };
}

/**
 * Helper to build content deck from list of raw feed items
 */
function buildContentDeck(likes: any[]): ContentCard[] {
  // We can take up to 100 likes, or more if we want. 
  // Original logic took the first page (up to 100).
  // Let's take up to 100 from the collected set.
  // Since we might have fetched more pages, let's just slice the first 100 
  // to keep behavior somewhat consistent, or use all?
  // Using all might be better diversity if we fetched deep. 
  // But let's stick to 100 to avoid huge decks? 
  // Actually, deck size isn't strictly limited by the game engine, but 100 is plenty.

  const validLikes = likes.slice(0, 100);

  return validLikes.map(item => {
    const post = item.post;
    const likeCount = post.likeCount || 0;
    const buzzFactor = likeCount + 1;

    // Extract Metadata
    const metadata: string[] = [];
    const record = post.record as any;

    // Image
    let imageUrl = undefined;

    // Check embed images
    if (post.embed?.images?.length > 0) {
      imageUrl = post.embed.images[0].fullsize;
      metadata.push('image');
    } else if (post.embed?.media?.images?.length > 0) {
      // RecordWithMedia
      imageUrl = post.embed.media.images[0].fullsize;
      metadata.push('image');
    }

    // Quote
    if (post.embed && (post.embed.$type === 'app.bsky.embed.record' || post.embed.$type === 'app.bsky.embed.recordWithMedia')) {
      metadata.push('quote');
    }

    // Link & Mention (Facets)
    if (record.facets) {
      for (const facet of record.facets) {
        if (facet.features) {
          for (const feature of facet.features) {
            if (feature.$type === 'app.bsky.richtext.facet#link') {
              if (!metadata.includes('link')) metadata.push('link');
            }
            if (feature.$type === 'app.bsky.richtext.facet#mention') {
              if (!metadata.includes('mention')) metadata.push('mention');
            }
          }
        }
      }
    }

    return {
      id: post.uri,
      type: 'content',
      authorHandle: post.author.handle,
      authorDisplayName: post.author.displayName,
      authorDid: post.author.did,
      text: record.text,
      imageUrl,
      buzzFactor,
      originalBuzzFactor: buzzFactor,
      metadata
    };
  });
}

/**
 * Helper to build avatar deck from candidate authors
 */
async function buildAvatarDeck(ag: Agent, candidates: any[]): Promise<AvatarCard[]> {
  // Shuffle and pick 25 randomly
  const selectedAuthors = candidates.sort(() => Math.random() - 0.5).slice(0, 25);

  if (selectedAuthors.length === 0) return [];

  // Fetch full profiles to get followers/follows counts
  // Batch fetch profiles
  let profilesMap = new Map<string, any>();
  try {
    // chunks of 25 is fine (max for getProfiles?) - actually getProfiles typically supports 25
    const profileRes = await ag.getProfiles({ actors: selectedAuthors.map(a => a.did) });
    profileRes.data.profiles.forEach(p => profilesMap.set(p.did, p));
  } catch (e) {
    console.warn("Failed to batch fetch profiles", e);
    // Fallback: Use what we have or try individual? 
    // The old code assumed it worked. If it fails, followers might be missing.
  }

  // Calculate Buzz Power in parallel
  const cards = await Promise.all(selectedAuthors.map(async f => {
    let buzzPower = 1;
    let lpd = 0;

    const profile = profilesMap.get(f.did);
    // specific logic for followers/follows if profile missing? 
    // Use defaults 0
    const followers = profile?.followersCount || 0;
    const follows = profile?.followsCount || 0;

    try {
      // Resolve PDS for the user
      const pdsEndpoint = await getPdsEndpoint(f.did);
      const pdsAgent = new Agent(pdsEndpoint || 'https://public.api.bsky.app');

      // Fetch recent 'like' records to estimate "likes per day" (Activity)
      const { data } = await pdsAgent.api.com.atproto.repo.listRecords({
        repo: f.did,
        collection: 'app.bsky.feed.like',
        limit: 30, // Sample size
      });

      if (data.records.length > 1) {
        // Fetch in reverse to get LATEST if needed, or assume default order
        // Actually existing logic fetches again with reverse: true if > 1 record found.
        // Is that necessary? listRecords default order is reverse (newest first)? 
        // Re-checking the original code: 
        /*
          const latestRes = await pdsAgent.api.com.atproto.repo.listRecords({ ... reverse: true });
        */
        // NOTE: reverse:true usually gives oldest first? Or newest? 
        // In atproto, listRecords returns keys. 
        // Let's trust the original logic's intent: Get a range of time.

        const latestRes = await pdsAgent.api.com.atproto.repo.listRecords({
          repo: f.did,
          collection: 'app.bsky.feed.like',
          limit: 30,
          reverse: true // The original code used this
        });

        const recs = latestRes.data.records;
        if (recs.length > 1) {
          const timestamps = recs.map(r => new Date((r.value as any).createdAt).getTime());
          const maxTime = Math.max(...timestamps);
          const minTime = Math.min(...timestamps);

          const diffMs = maxTime - minTime;
          const safeDiffMs = Math.max(diffMs, 60000);
          const diffDays = safeDiffMs / (1000 * 60 * 60 * 24);

          const freq = recs.length / diffDays;
          lpd = freq;
        }
      }
    } catch (e) {
      // console.warn(`Failed to calc buzz for ${f.handle}`, e);
    }

    // Formula:
    // resonance = ((followers * follows) / (followers + follows))
    // power = (log10(resonance+1)+1) * (LPD+1)

    let resonance = 0;
    if (followers + follows > 0) {
      resonance = (followers * follows) / (followers + follows);
    }

    const power = (Math.log10(resonance + 1) + 1) * (lpd + 1);
    buzzPower = Math.floor(power);
    if (buzzPower < 1) buzzPower = 1;

    return {
      id: f.did,
      type: 'avatar' as const,
      handle: f.handle,
      displayName: f.displayName,
      avatarUrl: f.avatar,
      buzzPower,
      originalBuzzFactor: 0,
      description: f.description
    };
  }));

  return cards;
}

// Keep original functions for backward compat if needed, 
// OR just implement them using fetchGameDecks? 
// The user asked to unify integration, implying usage in the app.
// But to be safe, we can leave them valid.

export async function fetchAvatarDeck(ag: Agent, actor: string): Promise<AvatarCard[]> {
  // Inefficient legacy call, or we can make it efficient?
  // Let's just wrap fetchGameDecks and return one part.
  // It does extra work (building content deck) but saves code duplication.
  const { avatarDeck } = await fetchGameDecks(ag, actor);
  return avatarDeck;
}

export async function fetchContentDeck(ag: Agent, actor: string): Promise<ContentCard[]> {
  const { contentDeck } = await fetchGameDecks(ag, actor);
  return contentDeck;
}
