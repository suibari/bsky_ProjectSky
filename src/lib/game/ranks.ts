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
