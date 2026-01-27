import { Agent } from '@atproto/api'; // Use class import for instantiation
import type { AvatarCard, ContentCard } from './types';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';

export async function fetchAvatarDeck(ag: Agent, actor: string): Promise<AvatarCard[]> {
  try {
    // Strategy: Fetch user's likes, extract unique authors, use them as Avatars.
    const collectedAuthors = new Map<string, any>(); // did -> profile/post.author
    let cursor: string | undefined;

    // Safety break
    let loopCount = 0;

    while (collectedAuthors.size < 25 && loopCount < 10) {
      loopCount++;
      const res = await ag.getActorLikes({
        actor,
        limit: 100,
        cursor
      });

      const likes = res.data.feed;
      if (!likes || likes.length === 0) break;

      for (const item of likes) {
        const author = item.post.author;
        if (author.did !== actor && !collectedAuthors.has(author.did)) {
          collectedAuthors.set(author.did, author);
        }
        if (collectedAuthors.size >= 50) break; // Fetch a bit more to shuffle
      }

      cursor = res.data.cursor;
      if (!cursor) break;
    }

    // Convert to array
    const candidates = Array.from(collectedAuthors.values());

    // Shuffle and pick 25 randomly
    const selectedAuthors = candidates.sort(() => Math.random() - 0.5).slice(0, 25);

    // Fetch full profiles to get followers/follows counts
    const profileRes = await ag.getProfiles({ actors: selectedAuthors.map(a => a.did) });
    const profilesMap = new Map<string, any>();
    profileRes.data.profiles.forEach(p => profilesMap.set(p.did, p));

    // Calculate Buzz Power in parallel
    const cards = await Promise.all(selectedAuthors.map(async f => {
      let buzzPower = 1;
      let lpd = 0;

      // New Formula Stats
      const profile = profilesMap.get(f.did);
      const followers = profile?.followersCount || 0;
      const follows = profile?.followsCount || 0;

      try {
        // Resolve PDS for the user
        const pdsEndpoint = await getPdsEndpoint(f.did);
        // Create a specific agent for this PDS (no auth needed for public records usually)
        const pdsAgent = new Agent(pdsEndpoint || 'https://public.api.bsky.app');

        // Fetch recent 'like' records to estimate "likes per day" (Activity)
        const { data } = await pdsAgent.api.com.atproto.repo.listRecords({
          repo: f.did,
          collection: 'app.bsky.feed.like',
          limit: 30, // Sample size
        });

        if (data.records.length > 1) {
          // Fetch in reverse to get LATEST if needed, or assume default order
          const latestRes = await pdsAgent.api.com.atproto.repo.listRecords({
            repo: f.did,
            collection: 'app.bsky.feed.like',
            limit: 30,
            reverse: true
          });

          const recs = latestRes.data.records;
          if (recs.length > 1) {
            const timestamps = recs.map(r => new Date(r.value.createdAt as string).getTime());
            const maxTime = Math.max(...timestamps);
            const minTime = Math.min(...timestamps);

            const diffMs = maxTime - minTime;
            // Ensure at least 1 minute diff to avoid large spikes or division by zero
            const safeDiffMs = Math.max(diffMs, 60000);
            const diffDays = safeDiffMs / (1000 * 60 * 60 * 24);

            const freq = recs.length / diffDays;

            // LPD (Likes Per Day)
            lpd = freq;
          }
        }
      } catch (e) {
        console.warn(`Failed to calc buzz for ${f.handle}`, e);
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

  } catch (e) {
    console.error("Failed to fetch avatar deck from likes", e);
    return [];
  }
}

export async function fetchContentDeck(ag: Agent, actor: string): Promise<ContentCard[]> {
  try {
    // getActorLikes returns FeedViewPost[]
    // 'ag' is the authenticated agent of the current user.
    // getActorLikes is an AppView method (app.bsky.feed.getActorLikes), usually handled by the PDS proxying to AppView.
    // So 'ag' is correct here.
    const res = await ag.getActorLikes({ actor, limit: 100 });
    const likes = res.data.feed;

    return likes.map(item => {
      const post = item.post;
      const likeCount = post.likeCount || 0;
      const buzzFactor = likeCount + 1;

      // Extract Metadata
      const metadata: string[] = [];
      const record = post.record as any;

      // Image
      // @ts-ignore
      let imageUrl = undefined;
      // @ts-ignore
      if (post.embed && post.embed.images && post.embed.images.length > 0) {
        // @ts-ignore
        imageUrl = post.embed.images[0].fullsize;
        metadata.push('image');
      } else if (post.embed && (post.embed as any).media && (post.embed as any).media.images && (post.embed as any).media.images.length > 0) {
        // RecordWithMedia
        // @ts-ignore
        imageUrl = (post.embed as any).media.images[0].fullsize;
        metadata.push('image');
      }

      // Quote
      // @ts-ignore
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
        authorDisplayName: post.author.displayName, // Map displayName
        authorDid: post.author.did,
        text: (post.record as any).text,
        imageUrl,
        buzzFactor,
        originalBuzzFactor: buzzFactor,
        metadata
      };
    });
  } catch (e) {
    console.error("Failed to fetch likes", e);
    return [];
  }
}
