import { Agent } from '@atproto/api'; // Use class import for instantiation
import type { AvatarCard, ContentCard } from './types';
import { publicAgent, getPdsEndpoint } from '$lib/atproto';

export async function fetchAvatarDeck(actor: string): Promise<AvatarCard[]> {
  try {
    // Fetch up to 2000 follows
    let allFollows: any[] = [];
    let cursor: string | undefined;

    while (allFollows.length < 2000) {
      const res = await publicAgent.getFollows({
        actor,
        limit: 100,
        cursor
      });
      allFollows = [...allFollows, ...res.data.follows];
      cursor = res.data.cursor;

      if (!cursor) break;
    }

    // Shuffle and pick 25 randomly
    const selectedFollows = allFollows.sort(() => Math.random() - 0.5).slice(0, 25);

    // Calculate Buzz Power in parallel
    const cards = await Promise.all(selectedFollows.map(async f => {
      let buzzPower = 1;

      try {
        // Resolve PDS for the user
        const pdsEndpoint = await getPdsEndpoint(f.did);
        // Create a specific agent for this PDS (no auth needed for public records usually)
        // Fallback to public API if resolution fails, though likely won't work if federated elsewhere.
        const pdsAgent = new Agent(pdsEndpoint || 'https://public.api.bsky.app');

        // Fetch recent 'like' records to estimate "likes per day" (Activity)
        // Use listRecords from the PDS-specific agent
        const { data } = await pdsAgent.api.com.atproto.repo.listRecords({
          repo: f.did,
          collection: 'app.bsky.feed.like',
          limit: 30, // Sample size
        });

        if (data.records.length > 1) {
          // Fetch in reverse to get LATEST if needed, or assume default order
          // Re-fetch consistent with PDS agent
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
            buzzPower = Math.floor(freq) + 1;
          }
        }
      } catch (e) {
        console.warn(`Failed to calc buzz for ${f.handle}`, e);
      }

      return {
        id: f.did,
        type: 'avatar' as const,
        handle: f.handle,
        displayName: f.displayName, // Map displayName
        avatarUrl: f.avatar,
        buzzPower,
        originalBuzzFactor: 0,
        description: f.description
      };
    }));

    return cards;

  } catch (e) {
    console.error("Failed to fetch follows", e);
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
