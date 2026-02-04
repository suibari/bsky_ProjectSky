export const GA_MEASUREMENT_ID = "G-G2Z5BK2R9P";

/**
 * Sends a Google Analytics event.
 * Safely checks if window.gtag exists.
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
    if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", eventName, params);
    } else {
        // Only log in dev mode if needed, or silently fail is fine for analytics
        if (import.meta.env.DEV) {
            console.log(`[GA Dev] Event: ${eventName}`, params);
        }
    }
}

export function trackGameStart(handle: string) {
    trackEvent("game_start", {
        handle: handle
    });
}

export function trackTurnStart(turn: number) {
    trackEvent("turn_start", {
        turn_count: turn
    });
}

export function trackCardPlay(card: { type: string; id: string; power: number; cost: number }) {
    trackEvent("card_play", {
        card_type: card.type,
        card_id: card.id,
        power: card.power,
        cost: card.cost
    });
}

export function trackGameEnd(score: number, rank: string) {
    trackEvent("game_end", {
        score: score,
        rank: rank
    });
}

export function trackShare(rank: string, score: number) {
    trackEvent("share_result", {
        rank: rank,
        score: score
    });
}
