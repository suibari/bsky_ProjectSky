import { GAME_CONFIG } from './config';

export function getRank(score: number): keyof typeof GAME_CONFIG.ranks {
    if (score >= GAME_CONFIG.ranks.SS) return 'SS';
    if (score >= GAME_CONFIG.ranks.S) return 'S';
    if (score >= GAME_CONFIG.ranks.A) return 'A';
    if (score >= GAME_CONFIG.ranks.B) return 'B';
    if (score >= GAME_CONFIG.ranks.C) return 'C';
    if (score >= GAME_CONFIG.ranks.D) return 'D';
    if (score >= GAME_CONFIG.ranks.E) return 'E';
    if (score >= GAME_CONFIG.ranks.F) return 'F';
    return 'G';
}

export function getRankProgress(score: number) {
    const rank = getRank(score);

    // Define thresholds for calculation
    let floor: number = 0;
    let ceiling: number = GAME_CONFIG.ranks.F;

    switch (rank) {
        case 'SS':
            return { percent: 100, floor: GAME_CONFIG.ranks.SS, ceiling: GAME_CONFIG.ranks.SS, rank };
        case 'S':
            floor = GAME_CONFIG.ranks.S;
            ceiling = GAME_CONFIG.ranks.SS;
            break;
        case 'A':
            floor = GAME_CONFIG.ranks.A;
            ceiling = GAME_CONFIG.ranks.S;
            break;
        case 'B':
            floor = GAME_CONFIG.ranks.B;
            ceiling = GAME_CONFIG.ranks.A;
            break;
        case 'C':
            floor = GAME_CONFIG.ranks.C;
            ceiling = GAME_CONFIG.ranks.B;
            break;
        case 'D':
            floor = GAME_CONFIG.ranks.D;
            ceiling = GAME_CONFIG.ranks.C;
            break;
        case 'E':
            floor = GAME_CONFIG.ranks.E;
            ceiling = GAME_CONFIG.ranks.D;
            break;
        case 'F':
            floor = GAME_CONFIG.ranks.F;
            ceiling = GAME_CONFIG.ranks.E;
            break;
        case 'G':
            floor = 0;
            ceiling = GAME_CONFIG.ranks.F;
            break;
    }

    const totalRange = ceiling - floor;
    const progress = score - floor;
    const percent = Math.max(0, Math.min(100, (progress / totalRange) * 100));

    return { percent, floor, ceiling, rank };
}
